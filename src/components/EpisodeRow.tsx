import { useState } from 'react';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { watchEpisode } from '../api/client';
import { queryClient, seasonOptions } from '../api/queries';
import type { CompleteMedia, TrackedMedia } from '../api/types';
import { episodeWatched } from '../lib/episodeState';
import { dateLabel, released } from '../lib/status';

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
  return <li data-season={season} data-episode={number ?? undefined} className={`episode ${watched ? 'watched' : !released(item?.release_datetime || null) ? 'upcoming' : ''}`}>
    <div className="episode-text"><span className="episode-code">S{String(season).padStart(2,'0')}E{number==null ? '??' : String(number).padStart(2,'0')}</span><h3>{item?.title || 'Episode title unavailable'}</h3><p>{dateLabel(item?.release_datetime || null)}{!watched && !canWatch ? ' · Upcoming' : ''}</p>{error && <p role="alert" className="inline-error">{error}</p>}</div>
    <button className="watch-button" disabled={!canWatch || saving} aria-label={watched ? `Watched: ${item?.title || 'episode'}` : canWatch ? `Mark ${item?.title || 'episode'} watched` : 'Episode not yet released'} onClick={()=>mutation.mutate()}>{mutation.isPending ? <span className="saving">···</span> : watched ? '✓' : canWatch ? '○' : <span className="future-dot">·</span>}</button>
  </li>;
}
