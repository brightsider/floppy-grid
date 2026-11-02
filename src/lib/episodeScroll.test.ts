import { describe,it,expect } from 'vitest';
import { episodeScrollTarget } from './episodeScroll';
import type { EpisodeSection } from './episodeScroll';
import type { TrackedMedia } from '../api/types';
const episode=(number:number,tracked:boolean,date:string|null='2020-01-01')=>({tracked,item:{episode_number:number,release_datetime:date}} as TrackedMedia);
const section=(number:number,episodes:TrackedMedia[],progress?:number,next?:number):EpisodeSection=>({summary:{item:{season_number:number},progress,next_episode:next==null?null:{episode_number:next}} as TrackedMedia,episodes});
describe('episode opening scroll destination',()=>{
  it('finds the first unwatched episode in watch order',()=>expect(episodeScrollTarget([section(1,[episode(1,true),episode(2,false),episode(3,false)])])).toEqual({season:1,episode:2}));
  it('waits until later seasons in watch order after watched seasons',()=>expect(episodeScrollTarget([section(1,[episode(1,true)]),section(2,[episode(1,true),episode(2,false)])])).toEqual({season:2,episode:2}));
  it('handles unordered provider metadata deterministically',()=>expect(episodeScrollTarget([section(2,[episode(2,false)]),section(1,[episode(3,false),episode(2,false)])])).toEqual({season:1,episode:2}));
  it('targets the next current-pass episode during a rewatch',()=>expect(episodeScrollTarget([section(2,[episode(6,true),episode(7,true),episode(8,true)],7,8)])).toEqual({season:2,episode:8}));
  it('includes future and undated unwatched episodes as scroll targets',()=>{
    expect(episodeScrollTarget([section(1,[episode(1,true),episode(2,false,'2099-01-01')])])).toEqual({season:1,episode:2});
    expect(episodeScrollTarget([section(1,[episode(1,false,null)])])).toEqual({season:1,episode:1});
  });
  it('scrolls to the end when everything is watched',()=>expect(episodeScrollTarget([section(1,[episode(1,true)]),section(2,[episode(1,true)])])).toBe('end'));
  it('scrolls to the end when completed seasons are collapsed or metadata is empty',()=>expect(episodeScrollTarget([])).toBe('end'));
  it('skips episodes with missing coordinates',()=>expect(episodeScrollTarget([section(1,[{tracked:false,item:null} as TrackedMedia])])).toBe('end'));
});
