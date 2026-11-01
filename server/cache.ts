import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { CompleteMedia, TrackedMedia, FeedEntry, FeedResponse } from '../src/api/types';
import { active } from '../src/lib/status';
import { compareUpNext, isTerminal, upcomingForQueue } from '../src/lib/upNext';

export class UpstreamError extends Error {
  constructor(public status:number) {super(status===401 || status===403 ? 'Floppy rejected the token or its permissions.' : `Floppy request failed (${status}).`);}
}
export class Floppy {
  private memo=new Map<string,{expires:number;value:CompleteMedia}>();
  private pending=new Map<string,Promise<CompleteMedia>>();
  constructor(private url:string,private token:string,private fetcher:typeof fetch=fetch) {}
  clear() { this.memo.clear(); this.pending.clear(); }
  async request<T>(path:string,body?:unknown):Promise<T> {
    let response:Response;
    try {
      response=await this.fetcher(`${this.url}/api/v1${path}`,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${this.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    } catch { throw new Error('Cannot reach Floppy. Check the server URL and network connection.'); }
    if (!response.ok) throw new UpstreamError(response.status);
    return response.json() as Promise<T>;
  }
  async library() {
    const rows:TrackedMedia[]=[];
    for(let offset=0;;) {
      const page=await this.request<{results:TrackedMedia[];pagination:{offset:number;limit:number;total:number}}>(`/media/tv/?limit=100&offset=${offset}`);
      if(!Array.isArray(page.results) || !page.pagination || page.pagination.limit<=0 || page.pagination.offset!==offset) throw new Error('Unsupported Floppy pagination.');
      rows.push(...page.results);
      offset+=page.pagination.limit;
      if(offset>=page.pagination.total) break;
    }
    return [...new Map(rows.filter(r=>r.item).map(r=>[`${r.item!.source}/${r.item!.media_id}`,r])).values()];
  }
  async metadata(path:string) {
    const cached=this.memo.get(path);
    if(cached && cached.expires>Date.now()) return cached.value;
    const pending=this.pending.get(path);
    if(pending) return pending;
    const task=this.request<CompleteMedia>(path).then(value=>{
      // Do not let an invalidated in-flight request repopulate the memo.
      if(this.pending.get(path)===task) this.memo.set(path,{value,expires:Date.now()+60000});
      return value;
    }).finally(()=>{if(this.pending.get(path)===task) this.pending.delete(path);});
    this.pending.set(path,task);
    return task;
  }
}
export const showPath=(source:string,id:string)=>`/media/tv/${encodeURIComponent(source)}/${encodeURIComponent(id)}/`;
export class FeedCache {
  private snapshot:{entries:FeedEntry[];updatedAt:string}|null=null;
  private flight:Promise<void>|null=null;
  private revision=0;
  private saving:Promise<void>=Promise.resolve();
  private failure:string|null=null;
  private active=0;
  private queue:Array<()=>void>=[];
  private file:string;
  private identity:string;
  constructor(private floppy:Floppy,private directory:string,url:string,token:string) {
    this.identity=createHash('sha256').update(JSON.stringify([url,token])).digest('hex');
    this.file=join(directory,'feed.json');
  }
  async load() {
    try {
      const stored=JSON.parse(await readFile(this.file,'utf8'));
      if(stored.version===1 && stored.identity===this.identity && Array.isArray(stored.entries) && typeof stored.updatedAt==='string') this.snapshot={entries:stored.entries,updatedAt:stored.updatedAt};
    } catch { /* Missing, corrupt or another account's cache starts cold. */ }
  }
  state():FeedResponse {
    return {ready:this.snapshot!==null,entries:this.snapshot?.entries || [],updatedAt:this.snapshot?.updatedAt || null,refreshing:this.flight!==null,error:this.failure};
  }
  private async limited<T>(fn:()=>Promise<T>) {
    if(this.active>=3) await new Promise<void>(resolve=>this.queue.push(resolve));
    else this.active++;
    try { return await fn(); }
    finally {const next=this.queue.shift();if(next)next();else this.active--;}
  }
  private async entry(row:TrackedMedia):Promise<FeedEntry|null> {
    if(!active(row) || !row.item) return null;
    if((row.episodes_left || 0)>0) return {row,next:null,lastAirDate:null};
    if(isTerminal(row.item.status)) return null;
    const path=showPath(row.item.source,row.item.media_id);
    const detail=await this.limited(()=>this.floppy.metadata(path));
    if(isTerminal(detail.details.status || row.item.status)) return null;
    const seasons=(detail.related.seasons || []).filter(s=>s.item?.season_number && s.status!==4);
    const data=await Promise.all(seasons.map(s=>this.limited(()=>this.floppy.metadata(`${path}${s.item!.season_number}/`))));
    const next=upcomingForQueue(row,detail,data.flatMap(s=>s.related.episodes || []));
    return next ? {row,next,lastAirDate:detail.details.last_air_date || null} : null;
  }
  private async save() {
    const data=JSON.stringify({version:1,identity:this.identity,...this.snapshot});
    const save=this.saving.catch(()=>{}).then(async()=>{
      await mkdir(this.directory,{recursive:true,mode:0o700});
      await writeFile(`${this.file}.tmp`,data,{mode:0o600});
      await rename(`${this.file}.tmp`,this.file);
    });
    this.saving=save;
    try { await save; } catch { this.failure='The feed is available, but its cache could not be saved. Check /data permissions and disk space.'; }
  }
  refresh():Promise<void> {
    if(this.flight) return this.flight;
    const revision=this.revision;
    this.flight=(async()=>{
      try {
        const rows=await this.floppy.library();
        const result=await Promise.all(rows.filter(active).map(row=>this.entry(row)));
        if(revision!==this.revision) return;
        this.snapshot={entries:result.filter((entry):entry is FeedEntry=>entry!==null).sort(compareUpNext),updatedAt:new Date().toISOString()};
        this.failure=null;
        await this.save();
      } catch(error) {
        if(revision===this.revision) this.failure=error instanceof Error ? error.message : 'Feed refresh failed.';
      }
    })().finally(()=>{this.flight=null;});
    return this.flight;
  }
  async watched(source:string,id:string) {
    // A background refresh started before this write cannot overwrite its result.
    this.revision++;
    this.floppy.clear();
    if(this.snapshot) {
      this.snapshot={...this.snapshot,entries:this.snapshot.entries.flatMap(entry=>{
        if(entry.row.item?.source!==source || entry.row.item.media_id!==id) return [entry];
        const behind=Math.max(0,(entry.row.episodes_left || 0)-1);
        return behind>0 ? [{...entry,row:{...entry.row,episodes_left:behind}}] : [];
      })};
      await this.save();
    }
    try {
      const rows=await this.floppy.library();
      const row=rows.find(row=>row.item?.source===source && row.item.media_id===id);
      const entry=row ? await this.entry(row) : null;
      const entries=(this.snapshot?.entries || []).filter(entry=>entry.row.item?.source!==source || entry.row.item.media_id!==id);
      if(entry) entries.push(entry);
      // A targeted update is not proof that the entire library was refreshed.
      if(this.snapshot) this.snapshot={...this.snapshot,entries:entries.sort(compareUpNext)};
      this.failure=null;
      await this.save();
    } catch {
      this.failure='Watch saved to Floppy; schedule refresh failed. The feed will retry in the background.';
    }
  }
}
