import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'floppy-smoke-'));
let behind=2,outage=false,writes=0;
const row=()=>({status:1,episodes_left:behind,total_episodes_left:behind,item_id:'tv_1',tracked:true,item:{source:'tmdb',media_id:'1',title:'Fixture TV',image:null,season_number:null,episode_number:null,release_datetime:null},next_episode:null,end_date:null});
const upstream=createServer(async(req,res)=>{
  if(outage) {res.writeHead(503);res.end('{}');return;}
  assert.equal(req.headers.authorization,'Bearer smoke-secret');
  let data;
  if(req.method==='POST') {writes++;behind--;data={tracked:true};res.statusCode=201;}
  else if(req.url.includes('?limit=')) data={results:[row()],pagination:{total:1,limit:100,offset:0}};
  else if(req.url.endsWith('/1/1/')) data={details:{},related:{episodes:[{tracked:false,item:{episode_number:3,release_datetime:'2099-01-01'}}]}};
  else data={details:{status:'Returning Series'},related:{seasons:[{item:{season_number:1},status:1}]}};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const upstreamUrl=`http://127.0.0.1:${upstream.address().port}`;
let app;
const port=Number(process.env.SMOKE_PORT || 9123);
const url=`http://127.0.0.1:${port}`;
function start() {
  app=spawn(process.execPath,['server-dist/index.mjs'],{env:{...process.env,PORT:String(port),FLOPPY_URL:upstreamUrl,FLOPPY_TOKEN:'smoke-secret',CACHE_DIR:dir,CACHE_REFRESH_SECONDS:'300'},stdio:['ignore','pipe','pipe']});
  // Consume logs without exposing them or risking pipe backpressure.
  app.stdout.resume();app.stderr.resume();
}
async function stop() {const done=once(app,'exit');app.kill('SIGTERM');await done;}
async function wait(test) {
  for(let i=0;i<100;i++) {try {const value=await test();if(value)return value;}catch{/* App may not yet be listening. */}await new Promise(r=>setTimeout(r,50));}
  throw new Error('Smoke check timed out');
}
try {
  start();
  await wait(async()=> (await fetch(`${url}/health`)).ok);
  let feed=await wait(async()=>{const f=await(await fetch(`${url}/api/grid/feed`)).json();return f.ready&&f;});
  assert.equal(feed.entries[0].row.episodes_left,2);
  const config=await(await fetch(`${url}/config.js`)).text();
  assert.ok(config.includes('SERVER_CACHE:true'));assert.ok(config.includes('__FLOPPY_GRID_CONFIG__'));assert.ok(config.includes('__FLOOPY_CONFIG__'));assert.ok(!config.includes('smoke-secret'));assert.ok(!config.includes(upstreamUrl));
  const page=await fetch(`${url}/show/tmdb/1`);assert.equal(page.status,200);
  assert.ok((await page.text()).includes('<title>Floppy Grid</title>'));
  const manifest=await(await fetch(`${url}/manifest.webmanifest`)).json();
  assert.equal(manifest.name,'Floppy Grid');assert.equal(manifest.short_name,'Floppy Grid');
  assert.equal((await fetch(`${url}/api/v1/arbitrary-route/`)).status,404);
  const watch=()=>fetch(`${url}/api/v1/media/tv/tmdb/1/1/episodes/1/watch/`,{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({external_id:`smoke-${writes}`})});
  const cross=await fetch(`${url}/api/v1/media/tv/tmdb/1/1/episodes/1/watch/`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://other.example'},body:'{"external_id":"blocked"}'});
  assert.equal(cross.status,403);assert.equal(writes,0);
  assert.equal((await watch()).status,201);
  feed=await(await fetch(`${url}/api/grid/feed`)).json();assert.equal(feed.entries[0].row.episodes_left,1);
  assert.equal((await watch()).status,201);
  feed=await(await fetch(`${url}/api/grid/feed`)).json();assert.deepEqual(feed.entries[0].next,{date:'2099-01-01'});
  assert.ok(!(await readFile(join(dir,'feed.json'),'utf8')).includes('smoke-secret'));
  await stop();outage=true;start();
  await wait(async()=> (await fetch(`${url}/health`)).ok);
  feed=await wait(async()=>{const f=await(await fetch(`${url}/api/grid/feed`)).json();return f.error&&f;});
  assert.equal(feed.ready,true);assert.equal(feed.entries[0].row.episodes_left,0);
  assert.equal((await watch()).status,503);
  assert.equal((await(await fetch(`${url}/api/grid/feed`)).json()).entries[0].row.episodes_left,0);
  console.log(`Smoke passed: port ${port}, private config, watch mutations, cross-origin rejection, persisted restart and outage fallback.`);
} finally {
  if(app && app.exitCode===null) await stop();
  upstream.close();await once(upstream,'close');
  await rm(dir,{recursive:true,force:true});
}
