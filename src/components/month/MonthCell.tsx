import { useState } from 'react';
import { format } from 'date-fns';
import { useUIStore } from '@/store/uiStore';
import MiniTaskPicker from './MiniTaskPicker';
import type { ScheduledTask } from '@/types';

interface Props {
    date: string;
    isCurrentMonth: boolean;
    scheduledTasks: ScheduledTask[];
}

export default function MonthCell({ date, isCurrentMonth, scheduledTasks }: Props) {
    const { setDate, setView } = useUIStore();
    const [showPicker, setShowPicker] = useState(false);
    const today = format(new Date(), 'yyyy-MM-dd');
    const isToday = date === today;
    const dayNum = format(new Date(date), 'd');
    const visible = scheduledTasks.slice(0, 3);
    const overflow = scheduledTasks.length - visible.length;

    return (
        <div className={`min-h-[100px] border-r border-b dark:border-gray-700 p-1 flex flex-col
      ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/50 opacity-50' : 'bg-white dark:bg-gray-800'}
      ${isToday ? 'ring-2 ring-inset ring-brand-amber' : ''}`}
        >
            {/* Day number + add button */}
            <div className="flex justify-between items-center mb-1">
                <button
                    onClick={() => { setDate(date); setView('day'); }}
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center
            hover:bg-brand-accent hover:text-white transition-colors
            ${isToday ? 'bg-brand-amber text-white' : 'dark:text-white'}`}
                >
                    {dayNum}
                </button>
                <button
                    onClick={() => setShowPicker(true)}
                    className="text-gray-300 hover:text-brand-accent text-sm leading-none"
                >
                    +
                </button>
            </div>

            {/* Task pills */}
            <div className="flex flex-col gap-0.5 flex-1">
                {visible.map((st) => (
                    <div
                        key={st.id}
                        className="text-xs px-1 py-0.5 rounded truncate border-l-2"
                        style={{
                            borderLeftColor: st.task.color,
                            backgroundColor: `${st.task.color}18`,
                            color: st.task.color,
                        }}
                    >
                        {st.task.title}
                    </div>
                ))}
                {overflow > 0 && (
                    <p className="text-xs text-brand-muted">+{overflow} more</p>
                )}
            </div>

            {showPicker && (
                <MiniTaskPicker date={date} onClose={() => setShowPicker(false)} />
            )}
        </div>
    );
}