import { describe,it,expect } from 'vitest';
import { compareUpNext,isTerminal,seasonInitiallyOpen,upcomingForQueue,type QueueCard } from './upNext';
import type { CompleteMedia, TrackedMedia } from '../api/types';
const row=(extra:Partial<TrackedMedia>={})=>({status:1,episodes_left:0,total_episodes_left:null,...extra} as TrackedMedia);
const card=(behind:number,date:string|null=null,lastAirDate:string|null=null):QueueCard=>({row:row({episodes_left:behind}),next:{date},lastAirDate});
describe('Floppy default Up Next order',()=>{
  it('sorts smallest backlog first, then future dates, recent last air date, unknown',()=>{
    const cards=[card(0),card(0,null,'2026-09-01'),card(0,'2026-11-12'),card(3),card(0,null,'2026-10-01'),card(1),card(0,'2026-11-03')];
    expect([...cards].sort(compareUpNext)).toEqual([cards[5],cards[3],cards[6],cards[2],cards[4],cards[1],cards[0]]);
  });
  it('breaks equal backlog ties by title',()=>{
    const a=card(1),b=card(1);
    a.row.item={title:'Alpha'} as NonNullable<TrackedMedia['item']>;
    b.row.item={title:'Bravo'} as NonNullable<TrackedMedia['item']>;
    expect(compareUpNext(a,b)).toBeLessThan(0);
  });
  it.each(['Ended',' CANCELED ','Cancelled','Finished_Airing','Complete','Concluded','Discontinued'])('recognizes terminal production status %s',status=>expect(isTerminal(status)).toBe(true));
  it('keeps continuing and unknown production statuses eligible',()=>{
    expect(isTerminal('Returning Series')).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });
});
describe('initial season expansion',()=>{
  it('collapses fully watched seasons',()=>expect(seasonInitiallyOpen(row({total_episodes_left:0,status:3}))).toBe(false));
  it('collapses fully watched seasons even if tracker status was not updated',()=>expect(seasonInitiallyOpen(row({total_episodes_left:0}))).toBe(false));
  it('opens current and future seasons even when caught up with releases',()=>expect(seasonInitiallyOpen(row({episodes_left:0,total_episodes_left:5}))).toBe(true));
  it('opens a completed season if newly added episodes remain',()=>expect(seasonInitiallyOpen(row({status:3,total_episodes_left:1}))).toBe(true));
  it('uses completed status when total is unknown',()=>expect(seasonInitiallyOpen(row({status:3}))).toBe(false));
  it('keeps untracked future seasons accessible',()=>expect(seasonInitiallyOpen(row({status:null}))).toBe(true));
});

describe('finished shows must not acquire a fabricated Upcoming badge',()=>{
  const detail=(details:CompleteMedia['details']={}):CompleteMedia=>({details,related:{},title:'Show',image:null,synopsis:null});
  const episode=(date:string|null,tracked=true)=>({tracked,item:{release_datetime:date}} as TrackedMedia);
  it('hides fully watched shows even when production status is missing',()=>{
    expect(upcomingForQueue(row(),detail(),[episode('2020-01-01')])).toBeNull();
  });
  it('hides caught-up returning shows without a real upcoming episode',()=>{
    expect(upcomingForQueue(row(),detail({status:'Returning Series'}),[episode('2020-01-01')])).toBeNull();
  });
  it('does not turn missing episode metadata into Upcoming',()=>{
    expect(upcomingForQueue(row(),detail(),[])).toBeNull();
  });
  it('uses terminal status on the library item when absent from details',()=>{
    const show=row({item:{status:'Ended'} as NonNullable<TrackedMedia['item']>});
    expect(upcomingForQueue(show,detail({next_episode_season:2}),[episode(null,false)])).toBeNull();
  });
  it('keeps an actual undated unwatched episode',()=>{
    expect(upcomingForQueue(row(),detail(),[episode(null,false)])).toEqual({date:null});
  });
  it('keeps an explicit upcoming-season hint',()=>{
    expect(upcomingForQueue(row(),detail({next_episode_season:2}),[])).toEqual({date:null});
  });
  it('keeps a known future unwatched episode',()=>{
    expect(upcomingForQueue(row(),detail(),[episode('2099-01-01',false)])).toEqual({date:'2099-01-01'});
  });
});
