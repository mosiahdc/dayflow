import { eachMinuteOfInterval, startOfDay, endOfDay, format } from 'date-fns';
import type { TimeSlot } from '@/types';

export function generateSlots(date: Date): TimeSlot[] {
    const intervals = eachMinuteOfInterval(
        { start: startOfDay(date), end: endOfDay(date) },
        { step: 30 }
    );
    return intervals.map((time, index) => ({
        index,
        label: format(time, 'HH:mm'),
        hour: time.getHours(),
        minute: time.getMinutes(),
    }));
}