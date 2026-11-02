import { describe,expect,it } from 'vitest';
import type { TrackedMedia } from '../api/types';
import { episodeWatched } from './episodeState';
import { seasonInitiallyOpen } from './upNext';
const episode=(number:number,tracked=true)=>({tracked,item:{episode_number:number}} as TrackedMedia);
const season=(progress:number|null,next:number|null=null)=>({progress,next_episode:next==null?null:{season_number:2,episode_number:next,air_date:null}} as TrackedMedia);
describe('current watch pass vs lifetime episode history',()=>{
  it('shows S02E08 unwatched during a 7/8 rewatch despite old lifetime watches',()=>{
    const pass=season(7,8);
    expect(episodeWatched(episode(6),pass)).toBe(true);
    expect(episodeWatched(episode(7),pass)).toBe(true);
    expect(episodeWatched(episode(8),pass)).toBe(false);
  });
  it('starts an explicit rewatch with all historical episodes available again',()=>{
    expect(episodeWatched(episode(1),season(0,1))).toBe(false);
    expect(episodeWatched(episode(8),season(0,1))).toBe(false);
  });
  it('respects the next-episode target for a gap before the furthest progress',()=>expect(episodeWatched(episode(3),season(7,3))).toBe(false));
  it('keeps untracked episodes unwatched even before current progress',()=>expect(episodeWatched(episode(3,false),season(7))).toBe(false));
  it('keeps a fully watched previous season watched',()=>expect(episodeWatched(episode(8),season(8))).toBe(true));
  it('falls back to lifetime state if older API responses omit pass progress',()=>expect(episodeWatched(episode(8),{} as TrackedMedia)).toBe(true));
  it('uses an optimistic current-pass watch until authoritative refresh',()=>expect(episodeWatched({...episode(8),optimisticWatched:true},season(7,8))).toBe(true));
  it('does not change raw lifetime state when projecting the current pass',()=>{
    const raw=episode(8);episodeWatched(raw,season(7,8));expect(raw.tracked).toBe(true);
  });
  it('opens a rewatch season when released episodes remain even with stale lifetime completion',()=>{
    expect(seasonInitiallyOpen({...season(7,8),episodes_left:1,total_episodes_left:0,status:3} as TrackedMedia)).toBe(true);
  });
});
