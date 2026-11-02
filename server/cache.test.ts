import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { FeedCache,Floppy,showPath } from './cache';
import type { TrackedMedia,CompleteMedia } from '../src/api/types';
let directory:string;
beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'floppy-cache-'));});
afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
const row=(behind=1):TrackedMedia=>({status:1,episodes_left:behind,total_episodes_left:behind,tracked:true,item_id:'tmdb_tv_1',next_episode:null,end_date:null,item:{source:'tmdb',media_id:'1',title:'Test show',image:null,season_number:null,episode_number:null,release_datetime:null}});
const show:CompleteMedia={title:'Test show',image:null,synopsis:null,details:{status:'Returning Series'},related:{seasons:[{...row(),item:{...row().item!,season_number:1}}]}};
const season:CompleteMedia={...show,related:{episodes:[{...row(),tracked:false,item:{...row().item!,season_number:1,episode_number:2,release_datetime:'2099-01-01'}}]}};
function fixture() {
  let rows=[row(2)];
  let fail=false;
  const fetcher=vi.fn(async(input:string|URL|Request)=>{
    if(fail) throw new Error('private upstream details');
    const url=String(input);
    const data=url.includes('?limit=') ? {results:rows,pagination:{offset:0,limit:100,total:rows.length}} : url.endsWith('/1/1/') ? season : show;
    return new Response(JSON.stringify(data));
  });
  const floppy=new Floppy('http://floppy.test','server-secret',fetcher as typeof fetch);
  const cache=new FeedCache(floppy,directory,'http://floppy.test','server-secret');
  return {cache,floppy,fetcher,setRows:(value:TrackedMedia[])=>{rows=value;},fail:()=>{fail=true;}};
}
describe('persistent feed cache',()=>{
  it('coalesces simultaneous refreshes and persists one successful snapshot',async()=>{
    const f=fixture();
    await Promise.all([f.cache.refresh(),f.cache.refresh(),f.cache.refresh()]);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(f.cache.state().entries[0].row.episodes_left).toBe(2);
    expect(f.cache.state().ready).toBe(true);
    expect(await readFile(join(directory,'feed.json'),'utf8')).not.toContain('server-secret');
  });
  it('serves the previous snapshot after restart and during an upstream outage',async()=>{
    const f=fixture();await f.cache.refresh();f.fail();
    const restarted=new FeedCache(f.floppy,directory,'http://floppy.test','server-secret');
    await restarted.load();
    const saved=restarted.state().updatedAt;
    expect(restarted.state().entries).toHaveLength(1);
    await restarted.refresh();
    expect(restarted.state().updatedAt).toBe(saved);
    expect(restarted.state().entries[0].row.episodes_left).toBe(2);
    expect(restarted.state().error).toContain('Cannot reach Floppy');
  });
  it('never restores a different account or server snapshot',async()=>{
    const f=fixture();await f.cache.refresh();
    for(const [url,token] of [['http://floppy.test','different-token'],['http://other.test','server-secret']]) {
      const cache=new FeedCache(f.floppy,directory,url,token);await cache.load();
      expect(cache.state().ready).toBe(false);
    }
  });
  it('recovers from an incomplete/corrupt cache file',async()=>{
    await writeFile(join(directory,'feed.json'),'{broken');
    const f=fixture();await f.cache.load();expect(f.cache.state().ready).toBe(false);
    await f.cache.refresh();expect(f.cache.state().ready).toBe(true);
  });
  it('excludes watched shows without upcoming evidence',async()=>{
    const f=fixture();f.setRows([{...row(0),item:{...row().item!,status:'Ended'}}]);
    await f.cache.refresh();expect(f.cache.state().entries).toHaveLength(0);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports token failure without exposing secret response content',async()=>{
    const floppy=new Floppy('http://floppy.test','server-secret',vi.fn(async()=>new Response('secret response',{status:403})) as typeof fetch);
    const cache=new FeedCache(floppy,directory,'http://floppy.test','server-secret');
    await cache.refresh();expect(cache.state().ready).toBe(false);
    expect(cache.state().error).toBe('Floppy rejected the token or its permissions.');
  });
  it('updates a watched show immediately and discovers its next future episode',async()=>{
    const f=fixture();f.setRows([row(1)]);await f.cache.refresh();
    f.setRows([row(0)]);await f.cache.watched('tmdb','1');
    expect(f.cache.state().entries[0].row.episodes_left).toBe(0);
    expect(f.cache.state().entries[0].next).toEqual({date:'2099-01-01'});
    const restored=new FeedCache(f.floppy,directory,'http://floppy.test','server-secret');await restored.load();
    expect(restored.state().entries[0].next).toEqual({date:'2099-01-01'});
  });
  it('does not let an old background build overwrite a watch update',async()=>{
    const f=fixture();await f.cache.refresh();
    let release!:(response:Response)=>void;
    f.fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{release=resolve;}));
    const oldRefresh=f.cache.refresh();
    f.setRows([row(1)]);await f.cache.watched('tmdb','1');
    release(new Response(JSON.stringify({results:[row(2)],pagination:{offset:0,limit:100,total:1}})));
    await oldRefresh;
    expect(f.cache.state().entries[0].row.episodes_left).toBe(1);
  });
  it('keeps a successful watch out of stale backlog when schedule refresh fails',async()=>{
    const f=fixture();f.setRows([row(1)]);await f.cache.refresh();f.fail();
    await f.cache.watched('tmdb','1');
    expect(f.cache.state().entries).toHaveLength(0);
    expect(f.cache.state().error).toContain('Watch saved');
  });
  it('memoizes and coalesces metadata and clears it after writes',async()=>{
    const f=fixture();const path=showPath('tmdb','1');
    await Promise.all([f.floppy.metadata(path),f.floppy.metadata(path)]);
    await f.floppy.metadata(path);expect(f.fetcher).toHaveBeenCalledTimes(1);
    f.floppy.clear();await f.floppy.metadata(path);expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
});
