import { startOfWeek, subDays, addDays, format, parseISO, getDay } from 'date-fns';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEK_DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEK_DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

// ── Work-week boundary ─────────────────────────────────────────────────────
// The work week resets Monday 8:00 AM PHT and runs through the following
// Monday 7:59 AM PHT. Slots are 30-min blocks (index = hour * 2), so 8:00 AM
// is slot 16. Anything on a Monday BEFORE slot 16 still belongs to the
// PREVIOUS work week (the one that's about to end at 7:59 AM that morning).
//
// Note: DayFlow doesn't track timezone per-record — `date` + `startSlot`
// are always treated as the user's own local wall-clock time (PHT), same
// as the rest of the app (see AGENT.md "UTC+8 / PHT timezone" notes).
export const WORK_WEEK_RESET_SLOT = 16; // 8:00 AM

const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Which weekday bucket (mon..sun) a calendar date falls under. Used purely
// for display grouping — NOT for deciding which work-week a task belongs to.
export function dayKeyOf(dateStr: string): DayKey {
  return JS_DAY_TO_KEY[getDay(parseISO(dateStr))]!;
}

// The Monday (yyyy-MM-dd) of the plain calendar week containing this date —
// ordinary Monday-Sunday grouping, ignoring time of day.
export function calendarMonday(dateStr: string): string {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

// The work-week a specific scheduled instance belongs to, identified by the
// Monday date that its work-week's 8:00 AM reset falls on. A block on
// Monday before 8:00 AM (e.g. 3–5 AM) still resolves to the PRIOR Monday —
// i.e. it counts toward last week's total, not the week that's about to start.
export function getWorkWeekStart(dateStr: string, startSlot: number): string {
  const monday = calendarMonday(dateStr);
  const isMonday = dateStr === monday;
  if (isMonday && startSlot < WORK_WEEK_RESET_SLOT) {
    return format(subDays(parseISO(monday), 7), 'yyyy-MM-dd');
  }
  return monday;
}

// A work week spans parts of 8 calendar dates (Monday 8AM through the
// following Monday 7:59AM), so fetching needs to cover one extra day past
// the plain calendar week.
export function getWorkWeekFetchRange(weekStart: string): { start: string; end: string } {
  return { start: weekStart, end: format(addDays(parseISO(weekStart), 7), 'yyyy-MM-dd') };
}

// Human-readable label for the work-week window, e.g.
// "Mon Aug 10, 8:00 AM – Mon Aug 17, 7:59 AM"
export function workWeekLabel(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 7);
  return `${format(start, 'EEE MMM d')}, 8:00 AM – ${format(end, 'EEE MMM d')}, 7:59 AM`;
}
