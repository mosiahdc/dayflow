import { memo } from 'react';
import { format } from 'date-fns';
import type { Habit, HabitEntry, DayOfWeek } from '@/types';

interface Props {
    habit: Habit;
    entries: HabitEntry[];
    dates: { date: string; day: DayOfWeek }[];
    onToggle: (habitId: string, date: string) => void;
    onDelete: (id: string) => void;
}

const HabitRow = memo(function HabitRow({ habit, entries, dates, onToggle, onDelete }: Props) {
    // Streak: count consecutive completed TARGET days going backwards from today
    const streak = (() => {
        let count = 0;
        const today = format(new Date(), 'yyyy-MM-dd');
        const targetDates = [...dates]
            .filter(({ day }) => habit.targetDays.includes(day))
            .filter(({ date }) => date <= today)
            .reverse();

        for (const { date } of targetDates) {
            const entry = entries.find((e) => e.habitId === habit.id && e.date === date);
            if (entry?.completed) count++;
            else break;
        }
        return count;
    })();

    return (
        <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
            {/* Color stripe + name */}
            <div className="flex items-center gap-2 w-40 shrink-0">
                <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold dark:text-white truncate">{habit.title}</p>
                    <p className="text-xs text-brand-muted capitalize">{habit.category}</p>
                </div>
            </div>

            {/* Day checkboxes */}
            <div className="flex gap-2 flex-1 justify-center">
                {dates.map(({ date, day }) => {
                    const isTarget = habit.targetDays.includes(day);
                    const entry = entries.find((e) => e.habitId === habit.id && e.date === date);
                    const completed = entry?.completed ?? false;
                    const isToday = date === format(new Date(), 'yyyy-MM-dd');

                    if (!isTarget) {
                        return (
                            <div key={date} className="w-7 h-7 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600" />
                            </div>
                        );
                    }

                    return (
                        <button
                            key={date}
                            onClick={() => onToggle(habit.id, date)}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center
                text-xs font-bold transition-all
                ${completed
                                    ? 'border-brand-green bg-brand-green text-white'
                                    : isToday
                                        ? 'border-brand-accent dark:border-brand-accent hover:border-brand-green'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-brand-green'}`}
                        >
                            {completed && '✓'}
                        </button>
                    );
                })}
            </div>

            {/* Streak */}
            <div className="w-14 text-center shrink-0">
                {streak > 0
                    ? <span className="text-xs font-bold text-brand-amber">{streak} 🔥</span>
                    : <span className="text-xs text-brand-muted">—</span>
                }
            </div>

            {/* Delete */}
            <button
                onClick={() => onDelete(habit.id)}
                className="text-gray-300 hover:text-red-400 text-sm shrink-0"
            >
                ×
            </button>
        </div>
    );
});

export default HabitRow;