import type { TrackedMedia } from '../api/types';
/** Episode.tracked describes lifetime history. Season.progress and next_episode
 * describe Floppy's current watch pass, including an explicit rewatch. */
export function episodeWatched(episode:TrackedMedia,season:TrackedMedia):boolean {
  if (episode.optimisticWatched) return true;
  if (!episode.tracked) return false;
  const number=episode.item?.episode_number;
  if(number==null) return episode.tracked;
  if(season.next_episode?.episode_number===number) return false;
  if(season.progress!=null && Number.isFinite(season.progress) && number>season.progress) return false;
  return true;
}
