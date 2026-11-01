import { createServer } from 'node:http';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FeedCache,Floppy,UpstreamError } from './cache';

const port=Number(process.env.PORT || 8080);
if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be 1–65535.');
const base=new URL(process.env.FLOPPY_URL || '');
if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash) throw new Error('FLOPPY_URL must be an HTTP(S) base URL.');
const token=process.env.FLOPPY_TOKEN;
if(!token) throw new Error('FLOPPY_TOKEN is required.');
const interval=Number(process.env.CACHE_REFRESH_SECONDS || 300);
if(!Number.isFinite(interval)||interval<30) throw new Error('CACHE_REFRESH_SECONDS must be at least 30.');
const upstream=new Floppy(base.href.replace(/\/$/,''),token);
const cache=new FeedCache(upstream,process.env.CACHE_DIR || '/data',base.href,token);
await cache.load();
const root=resolve(process.env.STATIC_DIR || fileURLToPath(new URL('../dist',import.meta.url)));
const json=(res:ServerResponse,status:number,data:unknown)=>{
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
};
async function body(req:IncomingMessage) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new UpstreamError(415);
  let text='';
  for await(const chunk of req) {
    text+=chunk;
    if(Buffer.byteLength(text)>16384) throw new UpstreamError(413);
  }
  try {return JSON.parse(text) as Record<string,unknown>;} catch {throw new UpstreamError(400);}
}
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};
let writing:Promise<unknown>=Promise.resolve();
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  try {
    const url=new URL(req.url || '/', 'http://localhost');
    if(req.method==='GET' && url.pathname==='/health') {res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok\n');return;}
    if(req.method==='GET' && url.pathname==='/config.js') {res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end('window.__FLOOPY_CONFIG__ = {SERVER_CACHE:true};\n');return;}
    if(req.method==='GET' && url.pathname==='/api/grid/feed') {
      const state=cache.state();
      if(url.searchParams.get('refresh')==='1' || !state.ready) void cache.refresh();
      json(res,200,cache.state());return;
    }
    const match=/^\/api\/v1(\/media\/tv\/[^/]+\/[^/]+\/(?:\d+\/(?:episodes\/\d+\/watch\/)?)?)$/.exec(url.pathname);
    if(match && !url.search) {
      const path=match[1];
      if(req.method==='GET' && !path.endsWith('/watch/')) {json(res,200,await upstream.metadata(path));return;}
      if(req.method==='POST' && path.endsWith('/watch/')) {
        const origin=req.headers.origin;
        if(req.headers['sec-fetch-site']==='cross-site' || (origin && new URL(origin).host!==req.headers.host)) {json(res,403,{error:'Cross-origin writes are not allowed.'});return;}
        const input=await body(req);
        if(typeof input.external_id!=='string'||input.external_id.length>200) {json(res,400,{error:'A watch event ID is required.'});return;}
        const parts=path.split('/');
        const task=writing.catch(()=>{}).then(async()=>{
          const result=await upstream.request(path,{external_id:input.external_id});
          await cache.watched(decodeURIComponent(parts[3]),decodeURIComponent(parts[4]));
          return result;
        });
        writing=task;
        json(res,201,await task);return;
      }
    }
    if(url.pathname.startsWith('/api/')) {json(res,404,{error:'Unknown API route.'});return;}
    if(req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405);res.end();return;}
    const path=resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(path!==root && !path.startsWith(`${root}/`)) {res.writeHead(404);res.end();return;}
    let file=path;
    try {if(!(await stat(file)).isFile()) file=resolve(root,'index.html');}
    catch {if(extname(path)) {res.writeHead(404);res.end();return;}file=resolve(root,'index.html');}
    res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':extname(file)==='.html'||file.endsWith('/sw.js')?'no-cache':'public, max-age=3600'});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  } catch(error) {
    if(!res.headersSent) json(res,error instanceof UpstreamError?error.status:502,{error:error instanceof UpstreamError?error.message:'Request failed. Check Floppy connectivity and try again.'});
    else res.end();
  }
});
server.listen(port,'0.0.0.0',()=>{console.log(`Floopy Grid listening on ${port}; persistent feed cache enabled.`);void cache.refresh();});
const timer=setInterval(()=>void cache.refresh(),interval*1000);
for(const signal of ['SIGTERM','SIGINT'] as const) process.on(signal,()=>{clearInterval(timer);server.close(()=>process.exit(0));});
