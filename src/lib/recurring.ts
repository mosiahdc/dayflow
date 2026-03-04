import { format, getDay } from 'date-fns';
import type { Task, DayOfWeek } from '@/types';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

export function shouldRecurOnDate(task: Task, date: string): boolean {
  const pattern = task.recurring;
  const dow     = DAY_MAP[getDay(new Date(date))] as DayOfWeek;

  if (pattern.type === 'none')     return false;
  if (pattern.type === 'daily')    return true;
  if (pattern.type === 'weekdays') return !['sat', 'sun'].includes(dow);
  if (pattern.type === 'weekly')   return pattern.days.includes(dow);
  return false;
}