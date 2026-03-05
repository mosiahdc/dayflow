import { eachMinuteOfInterval, startOfDay, endOfDay, format } from 'date-fns';
import type { TimeSlot } from '@/types';

export function generateSlots(_date: Date) {
  return Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const label = `${displayHour}:${minute}${period}`;
    return { index: i, label };
  });
}