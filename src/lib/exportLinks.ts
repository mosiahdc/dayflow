import type { ScheduledTask } from '@/types';
import { format, addMinutes } from 'date-fns';

function slotToDate(date: string, slot: number): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const hour      = Math.floor(slot / 2);
  const minute    = slot % 2 === 0 ? 0 : 30;
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, hour, minute);
}

function toGCal(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss");
}

export function googleCalLink(st: ScheduledTask): string {
  const start = slotToDate(st.date, st.startSlot);
  const end   = addMinutes(start, st.task.durationMins);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(st.task.title)}` +
    `&dates=${toGCal(start)}/${toGCal(end)}` +
    `&details=${encodeURIComponent(st.task.notes ?? '')}`;
}

export function outlookLink(st: ScheduledTask): string {
  const start = slotToDate(st.date, st.startSlot);
  const end   = addMinutes(start, st.task.durationMins);
  return `https://outlook.live.com/calendar/action/compose` +
    `?subject=${encodeURIComponent(st.task.title)}` +
    `&startdt=${start.toISOString()}` +
    `&enddt=${end.toISOString()}`;
}