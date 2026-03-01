import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format } from 'date-fns';
import MonthCell from './MonthCell';
import type { ScheduledTask } from '@/types';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
    monthDate: Date;
    scheduledTasks: ScheduledTask[];
}

export default function MonthView({ monthDate, scheduledTasks }: Props) {
    const cells = useMemo(() => {
        const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
        const days = [];
        let cur = start;
        while (cur <= end) {
            days.push(cur);
            cur = addDays(cur, 1);
        }
        return days;
    }, [monthDate]);

    const monthStr = format(monthDate, 'yyyy-MM');

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b dark:border-gray-700">
                {DAY_HEADERS.map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-brand-muted py-2 border-r dark:border-gray-700">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
                {cells.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isCurrentMonth = format(day, 'yyyy-MM') === monthStr;
                    const dayTasks = scheduledTasks.filter((t) => t.date === dateStr);
                    return (
                        <MonthCell
                            key={dateStr}
                            date={dateStr}
                            isCurrentMonth={isCurrentMonth}
                            scheduledTasks={dayTasks}
                        />
                    );
                })}
            </div>
        </div>
    );
}