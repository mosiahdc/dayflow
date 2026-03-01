import { useEffect, useMemo, useCallback } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { generateSlots } from '@/lib/intervals';
import TimeSlot from './TimeSlot';
import ExportMenu from './ExportMenu';
import type { ScheduledTask } from '@/types';

interface Props {
  date:           string;
  scheduledTasks: ScheduledTask[];
}

export default function DayView({ date, scheduledTasks }: Props) {
  const { fetchByDate, removeTask, toggleDone } = usePlannerStore();
  const slots = useMemo(() => generateSlots(new Date(date)), [date]);

  useEffect(() => { fetchByDate(date); }, [date, fetchByDate]);

  const tasksForSlot = useCallback((slotIndex: number) =>
    scheduledTasks.filter((st) => st.date === date && st.startSlot === slotIndex),
  [scheduledTasks, date]);

  const done  = scheduledTasks.filter((t) => t.date === date && t.done).length;
  const total = scheduledTasks.filter((t) => t.date === date).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-brand-accent text-white px-4 py-2 flex justify-between items-center">
        <span className="font-semibold text-sm">📅 Daily Planner</span>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {done}/{total} done
            </span>
          )}
          <ExportMenu date={date} />
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 bg-gray-100 dark:bg-gray-700">
          <div
            className="h-1 bg-brand-green transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* Grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
        {slots.map((slot) => (
          <TimeSlot
            key={slot.index}
            slot={slot}
            date={date}
            scheduledTasks={tasksForSlot(slot.index)}
            onRemove={removeTask}
            onToggle={toggleDone}
          />
        ))}
      </div>
    </div>
  );
}