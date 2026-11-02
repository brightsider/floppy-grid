import { useRef,useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { seasonOptions } from './api/queries';
import type { TrackedMedia } from './api/types';
import { seasonInitiallyOpen } from './lib/upNext';
import { useEpisodeAutoScroll } from './hooks/useEpisodeAutoScroll';
import { EpisodeRow } from './components/EpisodeRow';
import { ErrorState } from './components/Shared';
export function ShowEpisodes({source,id,seasons}:{source:string;id:string;seasons:TrackedMedia[]}) {
  const root=useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState<Record<number,boolean>>({});
  const ordered=seasons.filter(s=>s.item?.season_number!=null).sort((a,b)=>a.item!.season_number!-b.item!.season_number!);
  const open=ordered.map(s=>expanded[s.item!.season_number!] ?? seasonInitiallyOpen(s));
  const queries=useQueries({queries:ordered.map((summary,i)=>({...seasonOptions(source,id,summary.item!.season_number!),enabled:open[i]}))});
  // Wait for expanded sections to settle so earlier loading placeholders cannot
  // shift the target after scrolling. Errors retain the error/retry UI in view.
  const ready=queries.every((q,i)=>!open[i] || (q.isSuccess && !q.isFetching));
  const sections=ordered.flatMap((summary,i)=>open[i] && queries[i].data ? [{summary,episodes:queries[i].data!.related.episodes || []}] : []);
  useEpisodeAutoScroll(root,sections,ready);
  return <div ref={root}>
    {ordered.map((summary,i)=>{
      const number=summary.item!.season_number!;
      const query=queries[i];
      return <section className="season" key={number}>
        <button className="season-heading" onClick={()=>setExpanded(old=>({...old,[number]:!open[i]}))} aria-expanded={open[i]}>Season {number===0?'0 · Specials':number}<span aria-hidden="true">{open[i]?'−':'+'}</span></button>
        {open[i] && <>
          {query.isPending && <p className="season-loading" role="status">Loading episodes…</p>}
          {query.isError && <ErrorState error={query.error} retry={()=>void query.refetch()}/>}
          {query.data && <ul className="episodes">{query.data.related.episodes?.map((episode,index)=><EpisodeRow key={episode.item?.episode_number ?? index} episode={episode} source={source} id={id} season={number} summary={summary}/>)}</ul>}
          {query.data && !query.data.related.episodes?.length && <p className="season-loading">No episode metadata available yet.</p>}
        </>}
      </section>;
    })}
    <div data-episodes-end className="episodes-end" aria-hidden="true"/>
  </div>;
}
