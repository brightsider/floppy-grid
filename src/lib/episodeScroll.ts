import type { TrackedMedia } from '../api/types';
import { episodeWatched } from './episodeState';
export interface EpisodeSection {summary:TrackedMedia;episodes:TrackedMedia[]}
export type EpisodeScrollTarget={season:number;episode:number}|'end';
/** Watch order, including future episodes and the current rewatch pass. */
export function episodeScrollTarget(sections:EpisodeSection[]):EpisodeScrollTarget {
  for(const section of [...sections].sort((a,b)=>(a.summary.item?.season_number ?? 0)-(b.summary.item?.season_number ?? 0))) {
    const season=section.summary.item?.season_number;
    if(season==null) continue;
    const episodes=[...section.episodes].sort((a,b)=>(a.item?.episode_number ?? 0)-(b.item?.episode_number ?? 0));
    for(const episode of episodes) {
      const number=episode.item?.episode_number;
      if(number!=null && !episodeWatched(episode,section.summary)) return {season,episode:number};
    }
  }
  return 'end';
}
