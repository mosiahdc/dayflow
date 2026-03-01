import { useState } from 'react';
import { useHabitStore } from '@/store/habitStore';
import { CATEGORY_COLORS } from '@/types';
import type { Category, DayOfWeek } from '@/types';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CATEGORIES: Category[] = ['work', 'personal', 'health', 'learning'];

interface Props { onClose: () => void; }

export default function HabitForm({ onClose }: Props) {
    const { addHabit } = useHabitStore();
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<Category>('health');
    const [targetDays, setTargetDays] = useState<DayOfWeek[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
    const [error, setError] = useState('');

    const toggleDay = (d: DayOfWeek) =>
        setTargetDays((prev) =>
            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
        );

    const save = async () => {
        if (!title.trim()) { setError('Title required'); return; }
        await addHabit({
            title: title.trim(),
            category,
            color: CATEGORY_COLORS[category],
            targetDays,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm">
                <h2 className="font-bold text-lg mb-4 dark:text-white">New Habit</h2>

                <input
                    autoFocus
                    className="w-full border rounded-lg px-3 py-2 mb-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    placeholder="Habit title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                {/* Category */}
                <div className="flex gap-2 mb-3">
                    {CATEGORIES.map((c) => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className="flex-1 py-1 rounded text-xs font-semibold capitalize border-2 transition-all"
                            style={{
                                borderColor: CATEGORY_COLORS[c],
                                backgroundColor: category === c ? CATEGORY_COLORS[c] : undefined,
                                color: category === c ? 'white' : undefined,
                            }}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                {/* Target days */}
                <p className="text-xs text-brand-muted mb-1">Target days</p>
                <div className="flex gap-1 mb-4">
                    {DAYS.map((d) => (
                        <button
                            key={d}
                            onClick={() => toggleDay(d)}
                            className={`flex-1 py-1 rounded text-xs font-semibold uppercase transition-all
                ${targetDays.includes(d)
                                    ? 'bg-brand-green text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-brand-muted'}`}
                        >
                            {d[0]}
                        </button>
                    ))}
                </div>

                {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        className="flex-1 bg-brand-green text-white rounded-lg py-2 text-sm font-semibold"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}