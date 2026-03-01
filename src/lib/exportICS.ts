import { createEvents, EventAttributes } from 'ics';
import { stripCRLF } from './sanitize';
import type { ScheduledTask } from '@/types';

function slotToDateArray(date: string, slot: number): [number, number, number, number, number] {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const hour      = Math.floor(slot / 2);
  const minute    = slot % 2 === 0 ? 0 : 30;
  return [y ?? 0, m ?? 0, d ?? 0, hour, minute];
}

export async function buildICS(tasks: ScheduledTask[]): Promise<Blob> {
  const events: EventAttributes[] = tasks.map((st) => ({
    title:       stripCRLF(st.task.title),
    description: stripCRLF(st.task.notes ?? ''),
    start:       slotToDateArray(st.date, st.startSlot),
    duration:    { minutes: st.task.durationMins },
    uid:         `${st.id}@dayflow.app`,
    categories:  [st.task.category],
  }));

  return new Promise((resolve, reject) => {
    createEvents(events, (error, value) => {
      if (error) reject(error);
      else resolve(new Blob([value], { type: 'text/calendar' }));
    });
  });
}

export function downloadICS(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}