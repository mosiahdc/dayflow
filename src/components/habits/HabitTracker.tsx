import { useEffect, useState } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { useHabitStore } from '@/store/habitStore';
import { useUIStore } from '@/store/uiStore';
import HabitRow from './HabitRow';
import HabitForm from './HabitForm';
import type { DayOfWeek } from '@/types';

const DAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HabitTracker() {
    const { selectedDate } = useUIStore();
    const { habits, entries, fetchHabits, fetchEntries, toggleEntry, deleteHabit } = useHabitStore();
    const [showForm, setShowForm] = useState(false);

    // Build week dates from Monday
    const weekDates = (() => {
        const start = startOfWeek(new Date(selectedDate), { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i);
            return {
                date: format(d, 'yyyy-MM-dd'),
                day: DAY_KEYS[d.getDay()] as DayOfWeek,
                label: DAY_LABELS[d.getDay()] ?? '',
            };
        });
    })();

    useEffect(() => { fetchHabits(); }, [fetchHabits]);
    useEffect(() => {
        fetchEntries(weekDates.map((d) => d.date));
    }, [selectedDate]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
            {/* Header */}
            <div className="bg-brand-green text-white px-4 py-2 flex justify-between items-center">
                <span className="font-semibold text-sm">✅ Habit Tracker</span>
                <button
                    onClick={() => setShowForm(true)}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                >
                    + Add Habit
                </button>
            </div>

            {/* Day headers */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="w-40 shrink-0" />
                <div className="flex gap-2 flex-1 justify-center">
                    {weekDates.map(({ date, label }) => {
                        const isToday = date === format(new Date(), 'yyyy-MM-dd');
                        return (
                            <div key={date} className={`w-7 text-center text-xs font-semibold
                ${isToday ? 'text-brand-accent' : 'text-brand-muted'}`}>
                                {label}
                            </div>
                        );
                    })}
                </div>
                <div className="w-14 text-center text-xs font-semibold text-brand-muted shrink-0">
                    Streak
                </div>
                <div className="w-4 shrink-0" />
            </div>

            {/* Habit rows */}
            {habits.length === 0
                ? <p className="text-xs text-brand-muted text-center py-6">No habits yet. Add one!</p>
                : habits.map((habit) => (
                    <HabitRow
                        key={habit.id}
                        habit={habit}
                        entries={entries}
                        dates={weekDates}
                        onToggle={toggleEntry}
                        onDelete={deleteHabit}
                    />
                ))
            }

            {showForm && <HabitForm onClose={() => setShowForm(false)} />}
        </div>
    );
}