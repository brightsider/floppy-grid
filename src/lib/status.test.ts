import { describe, it, expect } from 'vitest';
import { calendarDays, findUpcoming, posterStatus, released, active } from './status';
import type { TrackedMedia } from '../api/types';
const now=new Date(2026,9,10,12);
describe('poster status',()=>{
  it.each([[3,'3 behind'],[1,'1 behind']])('prioritizes %i released episodes', (count,label)=>expect(posterStatus(count,{date:'2026-10-15'},now)).toBe(label));
  it.each([['2026-10-10','Today'],['2026-10-11','Tomorrow'],['2026-10-15','5 days'],[null,'Upcoming']])('handles %s', (date,label)=>expect(posterStatus(0,{date},now)).toBe(label));
  it('omits completed shows without upcoming episodes',()=>expect(posterStatus(0,null,now)).toBeNull());
  it('does not display an old air date as future',()=>expect(posterStatus(0,{date:'2026-10-09'},now)).toBeNull());
  it('handles invalid dates conservatively',()=>expect(posterStatus(0,{date:'invalid'},now)).toBe('Upcoming'));
  it('uses local calendar days across midnight',()=>expect(posterStatus(0,{date:'2026-10-11'},new Date(2026,9,10,23,59))).toBe('Tomorrow'));
  it('crosses year boundary',()=>expect(posterStatus(0,{date:'2027-01-01'},new Date(2026,11,31,23,59))).toBe('Tomorrow'));
  it('ignores DST day length',()=>expect(calendarDays(new Date(2026,2,9,0,1),new Date(2026,2,7,23,59))).toBe(2));
  it('treats offset timestamps as instants in local time',()=>{
    const instant='2026-10-11T00:30:00+14:00';
    const date=new Date(instant);
    expect(posterStatus(0,{date:instant},new Date(date.getFullYear(),date.getMonth(),date.getDate(),0))).toBe('Today');
  });
  it('does not allow unknown or future releases to be watched',()=>{
    expect(released(null,now)).toBe(false);
    expect(released('2026-10-11',now)).toBe(false);
    expect(released('2026-10-10',now)).toBe(true);
  });
});
const episode=(date:string|null,tracked=false)=>({tracked,item:{release_datetime:date}} as TrackedMedia);
describe('upcoming metadata',()=>{
  it('finds earliest future unwatched episode',()=>expect(findUpcoming([episode('2026-10-17'),episode('2026-10-13'),episode('2026-10-11',true),episode('2026-10-01')],now)).toEqual({date:'2026-10-13'}));
  it('keeps episodes with unknown dates',()=>expect(findUpcoming([episode(null)],now)).toEqual({date:null}));
  it('omits fully finished metadata',()=>expect(findUpcoming([episode('2026-10-01',true)],now)).toBeNull());
  it('matches the In progress only Up Next filter',()=>{
    expect(active({status:4} as TrackedMedia)).toBe(false);
    expect(active({status:2} as TrackedMedia)).toBe(false);
    expect(active({status:3} as TrackedMedia)).toBe(false);
    expect(active({status:0} as TrackedMedia)).toBe(false);
    expect(active({status:1} as TrackedMedia)).toBe(true);
  });
});
