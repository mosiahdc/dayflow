import { useEffect, useRef, useMemo, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { usePlannerStore } from '@/store/plannerStore';
import { useUIStore } from '@/store/uiStore';
import { useSwipe } from '@/hooks/useSwipe';
import { generateSlots } from '@/lib/intervals';
import TimeSlot from './TimeSlot';
import ExportMenu from './ExportMenu';
import TemplateMenu from './TemplateMenu';
import type { ScheduledTask } from '@/types';

interface Props {
  date: string;
  scheduledTasks: ScheduledTask[];
}

export interface TaskLayout {
  scheduledTask: ScheduledTask;
  col: number;
  totalCols: number;
}

function computeLayouts(tasks: ScheduledTask[]): Map<string, TaskLayout> {
  const layouts = new Map<string, TaskLayout>();
  const sorted = [...tasks].sort((a, b) => a.startSlot - b.startSlot);

  const taskSlots = new Map<string, Set<number>>();
  for (const task of sorted) {
    const spans = Math.max(1, task.task.durationMins / 30);
    const slots = new Set<number>();
    for (let i = 0; i < spans; i++) slots.add(task.startSlot + i);
    taskSlots.set(task.id, slots);
  }

  const visited = new Set<string>();

  for (const task of sorted) {
    if (visited.has(task.id)) continue;

    const group: ScheduledTask[] = [];
    const queue = [task];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      group.push(current);
      const currentSlots = taskSlots.get(current.id)!;
      for (const other of sorted) {
        if (visited.has(other.id)) continue;
        const otherSlots = taskSlots.get(other.id)!;
        if ([...currentSlots].some((s) => otherSlots.has(s))) queue.push(other);
      }
    }

    const colEnd: number[] = [];
    for (const t of group) {
      const slots = taskSlots.get(t.id)!;
      const startSlot = Math.min(...slots);
      const endSlot = Math.max(...slots);
      let col = colEnd.findIndex((end) => end < startSlot);
      if (col === -1) {
        col = colEnd.length;
        colEnd.push(endSlot);
      } else colEnd[col] = endSlot;
      layouts.set(t.id, { scheduledTask: t, col, totalCols: 0 });
    }

    const numCols = colEnd.length;
    const slotColCount = new Map<number, number>();
    for (const t of group) {
      const slots = taskSlots.get(t.id)!;
      for (const s of slots) slotColCount.set(s, (slotColCount.get(s) ?? 0) + 1);
    }

    for (const t of group) {
      const slots = taskSlots.get(t.id)!;
      const maxConcurrent = Math.max(...[...slots].map((s) => slotColCount.get(s) ?? 1));
      const l = layouts.get(t.id)!;
      layouts.set(t.id, { ...l, totalCols: Math.max(numCols, maxConcurrent) });
    }
  }

  return layouts;
}

export default function DayView({ date, scheduledTasks }: Props) {
  const { fetchByDate, removeTask, toggleDone } = usePlannerStore();
  const { setDate } = useUIStore();

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => setDate(format(addDays(new Date(date), 1), 'yyyy-MM-dd')),
    onSwipeRight: () => setDate(format(subDays(new Date(date), 1), 'yyyy-MM-dd')),
    threshold: 50,
    maxVertical: 80,
  });
  const slots = useMemo(() => generateSlots(new Date(date)), [date]);

  // Also fetch yesterday so we can detect overflow tasks
  const yesterday = useMemo(() => format(subDays(new Date(date), 1), 'yyyy-MM-dd'), [date]);

  useEffect(() => {
    fetchByDate(date);
  }, [date, fetchByDate]);
  useEffect(() => {
    fetchByDate(yesterday);
  }, [yesterday, fetchByDate]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll: if viewing today, scroll to 1 hour before current time.
  // If viewing any other date, scroll to top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) {
      const now = new Date();
      const currentSlot = now.getHours() * 2 + Math.floor(now.getMinutes() / 30);
      // Show 2 slots (1 hour) before current time, minimum slot 0
      const targetSlot = Math.max(0, currentSlot - 2);
      const slotHeight = 40; // min-h-[40px] per slot
      el.scrollTop = targetSlot * slotHeight;
    } else {
      el.scrollTop = 0;
    }
  }, [date]);

  // Today's tasks
  const dayTasks = useMemo(
    () => scheduledTasks.filter((st) => st.date === date),
    [scheduledTasks, date]
  );

  // Yesterday's tasks that overflow into today
  // A task overflows if: startSlot + (durationMins/30) > 48
  const overflowTasks = useMemo(() => {
    return scheduledTasks
      .filter((st) => st.date === yesterday)
      .filter((st) => st.startSlot + st.task.durationMins / 30 > 48)
      .map((st) => {
        const slotsUsedYesterday = 48 - st.startSlot;
        const remainingMins = st.task.durationMins - slotsUsedYesterday * 30;
        // Create a "virtual" continuation task starting at slot 0 today
        return {
          ...st,
          // Use a unique id so it doesn't conflict
          id: `overflow-${st.id}`,
          date,
          startSlot: 0,
          task: {
            ...st.task,
            durationMins: remainingMins,
            title: `↩ ${st.task.title} (cont.)`,
          },
        } as ScheduledTask;
      });
  }, [scheduledTasks, yesterday, date]);

  // Combine today's tasks + overflow continuations
  const allTasks = useMemo(() => [...overflowTasks, ...dayTasks], [overflowTasks, dayTasks]);

  const layouts = useMemo(() => computeLayouts(allTasks), [allTasks]);

  const tasksForSlot = useCallback(
    (slotIndex: number) =>
      allTasks
        .filter((st) => st.startSlot === slotIndex)
        .map((st) => layouts.get(st.id)!)
        .filter(Boolean),
    [allTasks, layouts]
  );

  const done = dayTasks.filter((t) => t.done).length;
  const total = dayTasks.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden flex flex-col">
      <div className="bg-brand-accent text-white px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">📅 Daily Planner</span>
          {total > 0 && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
              {done}/{total} done
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <TemplateMenu date={date} />
          <ExportMenu date={date} />
        </div>
      </div>

      {total > 0 && (
        <div className="h-1 bg-gray-100 dark:bg-gray-700">
          <div
            className="h-1 bg-brand-green transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: '520px' }}
        {...swipeHandlers}
      >
        {slots.map((slot) => (
          <TimeSlot
            key={slot.index}
            slot={slot}
            date={date}
            taskLayouts={tasksForSlot(slot.index)}
            onRemove={removeTask}
            onToggle={toggleDone}
          />
        ))}
      </div>
    </div>
  );
}
