import { useMemo, useState, useCallback, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import MonthView from '@/components/month/MonthView';

export default function MonthPage() {
    const { activeMonth } = useUIStore();
    const { scheduledTasks, fetchByWeek } = usePlannerStore();
    const monthDate = useMemo(() => new Date(`${activeMonth}-01`), [activeMonth]);

    const goMonth = useCallback((dir: 1 | -1) => {
        const fn = dir === 1 ? addMonths : subMonths;
        const next = format(fn(monthDate, 1), 'yyyy-MM');
        useUIStore.setState({ activeMonth: next });
    }, [monthDate]);

    useEffect(() => {
        const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        fetchByWeek(start, end);
    }, [activeMonth]);

    return (
        <div className="max-w-screen-xl mx-auto">
            <div className="flex items-center justify-between mb-3">
                <button onClick={() => goMonth(-1)} className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600">← Prev</button>
                <span className="font-semibold text-sm dark:text-white">
                    {format(monthDate, 'MMMM yyyy')}
                </span>
                <button onClick={() => goMonth(1)} className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600">Next →</button>
            </div>
            <MonthView monthDate={monthDate} scheduledTasks={scheduledTasks} />
        </div>
    );
}