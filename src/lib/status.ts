import type { TrackedMedia, Upcoming } from '../api/types';
// Bare dates are civil dates, never UTC instants. Timestamps use local time.
export function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(+match[1], +match[2]-1, +match[3]) : new Date(value);
}
export function calendarDays(date:Date, now:Date) {
  const ordinal = (d:Date) => Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()) / 86400000;
  return ordinal(date)-ordinal(now);
}
export function posterStatus(behind:number|null, next:Upcoming|null, now=new Date()):string|null {
  if (behind !== null && behind > 0) return `${behind} behind`;
  if (!next) return null;
  if (!next.date) return 'Upcoming';
  const date = parseDate(next.date);
  if (Number.isNaN(date.getTime())) return 'Upcoming';
  const days = calendarDays(date, now);
  if (days < 0) return null;
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
}
export function released(value:string|null, now=new Date()) {
  if (!value) return false;
  return parseDate(value).getTime() <= now.getTime();
}
export function findUpcoming(episodes:TrackedMedia[], now=new Date()):Upcoming|null {
  const unwatched = episodes.filter(e=>!e.tracked);
  const future = unwatched.map(e=>e.item?.release_datetime).filter((d):d is string=>!!d && parseDate(d).getTime()>now.getTime()).sort((a,b)=>parseDate(a).getTime()-parseDate(b).getTime());
  if (future[0]) return {date:future[0]};
  return unwatched.some(e=>!e.item?.release_datetime) ? {date:null} : null;
}
export function active(row:TrackedMedia) { return row.status === 1; }
export function dateLabel(value:string|null) {
  if (!value) return 'Date to be announced';
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
