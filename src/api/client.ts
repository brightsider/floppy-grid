import { getConfig } from '../config/runtime';
import type { Page, TrackedMedia, CompleteMedia } from './types';
export class ApiError extends Error {
  constructor(public status:number) {
    super(status===401 || status===403 ? 'Floppy rejected the token or its permissions. Check the app token and scopes in Floppy Settings.' : `Floppy returned an error (${status}). Please try again.`);
  }
}
export async function request<T>(path:string, options:RequestInit={}):Promise<T> {
  const {url,token}=getConfig();
  let response:Response;
  const timeout=AbortSignal.timeout(30000);
  try { response=await fetch(`${url}/api/v1${path}`,{...options,signal:options.signal ? AbortSignal.any([options.signal,timeout]) : timeout,cache:'no-store',credentials:'omit',redirect:'error',headers:{Authorization:`Bearer ${token}`,...(options.body ? {'Content-Type':'application/json'} : {})}}); }
  catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('Cannot reach Floppy. Check your connection, server URL, HTTPS and CORS configuration.');
  }
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
export async function getLibrary(signal?:AbortSignal) {
  const results:TrackedMedia[]=[];
  let offset=0;
  while (true) {
    const page=await request<Page<TrackedMedia>>(`/media/tv/?limit=100&offset=${offset}`,{signal});
    if (!Array.isArray(page.results) || !page.pagination || page.pagination.limit<=0) throw new Error('Unsupported Floppy library response. Check the server version.');
    results.push(...page.results);
    offset=page.pagination.offset+page.pagination.limit;
    if (offset>=page.pagination.total) break;
  }
  return [...new Map(results.filter(r=>r.item).map(r=>[`${r.item!.source}/${r.item!.media_id}`,r])).values()];
}
export const mediaPath=(source:string,id:string)=>`/media/tv/${encodeURIComponent(source)}/${encodeURIComponent(id)}/`;
export const getShow=(source:string,id:string,signal?:AbortSignal)=>request<CompleteMedia>(mediaPath(source,id),{signal});
export const getSeason=(source:string,id:string,season:number,signal?:AbortSignal)=>request<CompleteMedia>(`${mediaPath(source,id)}${season}/`,{signal});
export const watchEpisode=(source:string,id:string,season:number,episode:number,externalId:string)=>request<TrackedMedia>(`${mediaPath(source,id)}${season}/episodes/${episode}/watch/`,{method:'POST',body:JSON.stringify({external_id:externalId})});
