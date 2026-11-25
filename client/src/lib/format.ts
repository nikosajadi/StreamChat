// ===========================================================================
// lib/format.ts: dates and times as people say them.
// ===========================================================================
import type { PublicUser } from './socket';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** "14:05" */
export const formatTime = (t: number) => timeFmt.format(t);

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Key used to group messages by calendar day. */
export const dayKey = (t: number) => startOfDay(t);

/** "Today", "Yesterday" or "Monday, 24 November". */
export function dayLabel(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return dayFmt.format(t);
}

/** "online", "last seen just now", "last seen 5 min ago", "last seen at 14:05". */
export function presenceText(u: PublicUser, now = Date.now()): string {
  if (u.online) return 'online';
  const s = Math.max(0, Math.floor((now - u.lastSeen) / 1000));
  if (s < 60) return 'last seen just now';
  if (s < 3600) return `last seen ${Math.floor(s / 60)} min ago`;
  if (dayKey(u.lastSeen) === dayKey(now)) return `last seen at ${formatTime(u.lastSeen)}`;
  return `last seen ${dayLabel(u.lastSeen, now).toLowerCase()}`;
}
