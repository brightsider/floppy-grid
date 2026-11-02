import { useState } from 'react';
import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { watchEpisode } from './api/client';
import { queryClient, seasonOptions, showOptions } from './api/queries';
import type { CompleteMedia, TrackedMedia } from './api/types';
import { episodeWatched } from './lib/episodeState';
import { seasonInitiallyOpen } from './lib/upNext';
import { dateLabel, released } from './lib/status';
import { ErrorState, Poster } from './components/Shared';

export function EpisodeRow({episode,source,id,season,summary}:{episode:TrackedMedia;source:string;id:string;season:number;summary:TrackedMedia}) {
  const [error,setError]=useState('');
  const saving=useIsMutating({mutationKey:['watch',source,id]})>0;
  const number=episode.item?.episode_number;
  const watched=episodeWatched(episode,summary);
  const canWatch=!watched && released(episode.item?.release_datetime || null) && number!=null;
  const key=seasonOptions(source,id,season).queryKey;
  const mutation=useMutation({
    mutationKey:['watch',source,id],
    scope:{id:`watch-${source}-${id}`},
    mutationFn:()=>watchEpisode(source,id,season,number!,(crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''))),
    onMutate:async()=>{
      setError('');
      await queryClient.cancelQueries({queryKey:key});
      const previous=queryClient.getQueryData<CompleteMedia>(key);
      queryClient.setQueryData<CompleteMedia>(key,old=>old ? {...old,related:{...old.related,episodes:old.related.episodes?.map(e=>e.item?.episode_number===number ? {...e,tracked:true,optimisticWatched:true} : e)}} : old);
      return {previous};
    },
    onError:(_error,_variables,context)=>{
      if(context?.previous) queryClient.setQueryData<CompleteMedia>(key,old=>old ? {...old,related:{...old.related,episodes:old.related.episodes?.map(e=>e.item?.episode_number===number ? context.previous!.related.episodes!.find(p=>p.item?.episode_number===number)! : e)}} : old);
      setError('Couldn’t save to Floppy. Please try again.');
    },
    onSuccess:()=>{
      queryClient.setQueryData<TrackedMedia[]>(['library'],old=>old?.map(row=>row.item?.source===source && row.item.media_id===id ? {...row,episodes_left:row.episodes_left===null ? null : Math.max(0,row.episodes_left-1)} : row));
    },
    onSettled:async()=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:['library']}),
        queryClient.invalidateQueries({queryKey:['feed']}),
        queryClient.invalidateQueries({queryKey:['show',source,id]}),
        queryClient.invalidateQueries({queryKey:key}),
        queryClient.invalidateQueries({queryKey:['upcoming',source,id]}),
      ]);
    },
  });
  const item=episode.item;
  return <li className={`episode ${watched ? 'watched' : !released(item?.release_datetime || null) ? 'upcoming' : ''}`}>
    <div className="episode-text"><span className="episode-code">S{String(season).padStart(2,'0')}E{number==null ? '??' : String(number).padStart(2,'0')}</span><h3>{item?.title || 'Episode title unavailable'}</h3><p>{dateLabel(item?.release_datetime || null)}{!watched && !canWatch ? ' · Upcoming' : ''}</p>{error && <p role="alert" className="inline-error">{error}</p>}</div>
    <button className="watch-button" disabled={!canWatch || saving} aria-label={watched ? `Watched: ${item?.title || 'episode'}` : canWatch ? `Mark ${item?.title || 'episode'} watched` : 'Episode not yet released'} onClick={()=>mutation.mutate()}>{mutation.isPending ? <span className="saving">···</span> : watched ? '✓' : canWatch ? '○' : <span className="future-dot">·</span>}</button>
  </li>;
}
function Season({source,id,season,summary}:{source:string;id:string;season:number;summary:TrackedMedia}) {
  const [expanded,setExpanded]=useState<boolean|null>(null);
  const open=expanded ?? seasonInitiallyOpen(summary);
  const query=useQuery({...seasonOptions(source,id,season),enabled:open});
  return <section className="season"><button className="season-heading" onClick={()=>setExpanded(!open)} aria-expanded={open}>Season {season===0 ? '0 · Specials' : season}<span aria-hidden="true">{open ? '−' : '+'}</span></button>{open && <>
    {query.isPending && <p className="season-loading" role="status">Loading episodes…</p>}
    {query.isError && <ErrorState error={query.error} retry={()=>void query.refetch()}/>}
    {query.data && <ul className="episodes">{query.data.related.episodes?.map((e,i)=><EpisodeRow key={e.item?.episode_number ?? i} episode={e} source={source} id={id} season={season} summary={summary}/>)}</ul>}
    {query.data && !query.data.related.episodes?.length && <p className="season-loading">No episode metadata available yet.</p>}
  </>}</section>;
}
export function Show() {
  const {source='',id=''}=useParams();
  const location=useLocation();
  const navigate=useNavigate();
  const query=useQuery(showOptions(source,id));
  const back=()=>{if(location.state?.fromHome && window.history.state?.idx>0) void navigate(-1); else void navigate('/',{replace:true});};
  return <main>
    <header className="detail-header"><button className="back" onClick={back}>‹ Back</button><Link to="/" className="quiet-link">Up next</Link></header>
    {query.isPending && <div className="detail-skeleton" role="status">Loading show…</div>}
    {query.isError && <ErrorState error={query.error} retry={()=>void query.refetch()}/>}
    {query.data && <><div className="show-intro"><Poster image={query.data.image} title={query.data.title || 'TV show'}/><div><p className="eyebrow">YOUR EPISODES</p><h1>{query.data.title || 'Untitled show'}</h1><p className="show-hint">One tap to mark watched.</p></div></div>
    {(query.data.related.seasons || []).filter(s=>s.item?.season_number!=null).sort((a,b)=>a.item!.season_number!-b.item!.season_number!).map(s=><Season key={s.item!.season_number} source={source} id={id} season={s.item!.season_number!} summary={s}/>)}
    {!query.data.related.seasons?.length && <div className="notice"><h2>No seasons yet</h2><p>Floppy has no season metadata for this show.</p></div>}
    </>}
  </main>;
}
