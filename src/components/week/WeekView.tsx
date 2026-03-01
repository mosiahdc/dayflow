import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { generateSlots } from '@/lib/intervals';
import type { ScheduledTask } from '@/types';

interface SlotProps {
    id: string;
    scheduledTasks: ScheduledTask[];
}

function WeekSlotCell({ id, scheduledTasks }: SlotProps) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`border-r border-b dark:border-gray-700 relative min-h-[36px] transition-colors
        ${isOver ? 'bg-brand-accent/10' : ''}`}
        >
            {scheduledTasks.map((st, i) => {
                const total = scheduledTasks.length;
                const w = `${100 / total}%`;
                return (
                    <div
                        key={st.id}
                        className="absolute top-0.5 rounded text-xs px-1 py-0.5 truncate border-l-2 overflow-hidden"
                        style={{
                            borderLeftColor: st.task.color,
                            backgroundColor: `${st.task.color}22`,
                            height: `${(st.task.durationMins / 30) * 36 - 2}px`,
                            width: `calc(${w} - 2px)`,
                            left: `calc(${i} * ${w})`,
                        }}
                    >
                        <span className="dark:text-white font-semibold truncate block">{st.task.title}</span>
                    </div>
                );
            })}
        </div>
    );
}

interface Props {
    weekDates: { date: string; label: string }[];
    scheduledTasks: ScheduledTask[];
    fetchByWeek: (start: string, end: string) => Promise<void>;
}

export default function WeekView({ weekDates, scheduledTasks, fetchByWeek }: Props) {
    const slots = useMemo(() => generateSlots(new Date()), []);
    const today = format(new Date(), 'yyyy-MM-dd');
    const start = weekDates[0]?.date ?? '';
    const end = weekDates[6]?.date ?? '';

    useEffect(() => {
        if (start && end) fetchByWeek(start, end);
    }, [start, end, fetchByWeek]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
            {/* Day headers */}
            <div className="grid sticky top-0 z-20 bg-white dark:bg-gray-800 border-b dark:border-gray-700"
                style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                <div className="border-r dark:border-gray-700" />
                {weekDates.map(({ date, label }) => (
                    <div
                        key={date}
                        className={`text-center text-xs font-semibold py-2 border-r dark:border-gray-700
              ${date === today ? 'bg-brand-teal text-white' : 'dark:text-white'}`}
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* Time grid */}
            <div className="overflow-y-auto" style={{ maxHeight: '75vh' }}>
                {slots.map((slot) => (
                    <div
                        key={slot.index}
                        className="grid"
                        style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
                    >
                        <div className="text-xs text-brand-muted px-1 py-1 border-r border-b dark:border-gray-700 shrink-0">
                            {slot.label}
                        </div>
                        {weekDates.map(({ date }) => (
                            <WeekSlotCell
                                key={date}
                                id={`week-slot-${date}::${slot.index}`}
                                scheduledTasks={scheduledTasks.filter(
                                    (t) => t.date === date && t.startSlot === slot.index
                                )}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}