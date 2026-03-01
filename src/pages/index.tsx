import { useMemo } from 'react';
import { generateSlots } from '@/lib/intervals';
import { useUIStore } from '@/store/uiStore';

export default function DayView() {
    const { selectedDate } = useUIStore();
    const slots = useMemo(
        () => generateSlots(new Date(selectedDate)),
        [selectedDate]
    );

    return (
        <div className="max-w-screen-xl mx-auto">
            <h2 className="text-lg font-bold mb-3 text-brand-dark dark:text-white">
                📅 {selectedDate}
            </h2>

            {/* Row 1 */}
            <div className="flex gap-4 mb-4">
                {/* Planner grid */}
                <div className="w-[58%] bg-white dark:bg-gray-800 rounded-lg shadow border overflow-hidden">
                    <div className="bg-brand-accent text-white px-4 py-2 font-semibold text-sm">
                        Daily Planner
                    </div>
                    <div className="overflow-y-auto max-h-[500px]">
                        {slots.map((slot) => (
                            <div
                                key={slot.index}
                                className="flex items-center border-b border-brand-border hover:bg-brand-bg dark:hover:bg-gray-700 min-h-[40px]"
                            >
                                <span className="w-14 text-xs text-brand-muted px-2 shrink-0">
                                    {slot.label}
                                </span>
                                <div className="flex-1 px-2 py-1" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priority panel */}
                <div className="w-[40%] bg-white dark:bg-gray-800 rounded-lg shadow border overflow-hidden">
                    <div className="bg-brand-accent2 text-white px-4 py-2 font-semibold text-sm">
                        Priority / This Week
                    </div>
                    <div className="p-3 text-sm text-brand-muted">
                        Tasks will appear here…
                    </div>
                </div>
            </div>

            {/* Row 2 — Habit Tracker */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border overflow-hidden">
                <div className="bg-brand-green text-white px-4 py-2 font-semibold text-sm">
                    ✅ Habit Tracker
                </div>
                <div className="p-3 text-sm text-brand-muted">
                    Habits will appear here…
                </div>
            </div>
        </div>
    );
}