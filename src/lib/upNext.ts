import type { TrackedMedia, Upcoming } from '../api/types';
import { parseDate } from './status';
// Floppy users/home_screen.py: _episode_feed_sort_values and row filter.
const terminal=new Set(['ended','canceled','cancelled','finished','finished airing','completed','complete','concluded','discontinued']);
export function isTerminal(status?:string|null) {
  return terminal.has((status || '').trim().toLowerCase().replaceAll('_',' '));
}
export interface QueueCard {row:TrackedMedia;next:Upcoming|null;lastAirDate:string|null}
function rank(card:QueueCard):[number,number] {
  if ((card.row.episodes_left || 0)>0) return [0,card.row.episodes_left!];
  if (card.next?.date) {
    const date=parseDate(card.next.date).getTime();
    if (Number.isFinite(date)) return [1,date];
  }
  if (card.lastAirDate) {
    const date=parseDate(card.lastAirDate).getTime();
    if(Number.isFinite(date)) return [2,-date];
  }
  return [3,0];
}
export function compareUpNext(a:QueueCard,b:QueueCard) {
  const ar=rank(a),br=rank(b);
  return ar[0]-br[0] || ar[1]-br[1] || (a.row.item?.title || '').localeCompare(b.row.item?.title || '') || (a.row.item_id || '').localeCompare(b.row.item_id || '');
}
export function seasonInitiallyOpen(season:TrackedMedia) {
  // Released episodes left alone cannot establish completion: future episodes
  // may still exist. Only completed status / known total remaining can do so.
  if (season.total_episodes_left != null) return season.total_episodes_left>0;
  return season.status!==3;
}
