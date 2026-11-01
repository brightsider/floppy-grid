import { QueryClient, queryOptions } from '@tanstack/react-query';
import { ApiError, getFeed, getLibrary, getSeason, getShow } from './client';
export const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:60000,refetchOnWindowFocus:'always',refetchOnReconnect:'always',retry:(count,error)=>!(error instanceof ApiError && [401,403,404].includes(error.status)) && count<1},mutations:{retry:false}}});
export const libraryOptions=queryOptions({queryKey:['library'],queryFn:({signal})=>getLibrary(signal)});
export const showOptions=(source:string,id:string)=>queryOptions({queryKey:['show',source,id],queryFn:({signal})=>getShow(source,id,signal)});
export const seasonOptions=(source:string,id:string,season:number)=>queryOptions({queryKey:['season',source,id,season],queryFn:({signal})=>getSeason(source,id,season,signal)});
// Bound provider metadata work across the whole grid, including parallel shows.
let running=0;
const queue:Array<()=>void>=[];
export async function metadataTask<T>(task:()=>Promise<T>):Promise<T> {
  if (running>=3) await new Promise<void>(resolve=>queue.push(resolve));
  else running++;
  try { return await task(); }
  finally { const next=queue.shift(); if(next) next(); else running--; }
}

export const feedOptions=queryOptions({queryKey:['feed'],queryFn:({signal})=>getFeed(false,signal),refetchInterval:query=>query.state.data?.refreshing || (query.state.data && !query.state.data.ready && !query.state.data.error) ? 3000 : 60000});
