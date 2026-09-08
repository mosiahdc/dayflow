import { useEffect, useRef, useMemo, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { usePlannerStore } from '@/store/plannerStore';
import { useUIStore } from '@/store/uiStore';
import { useSwipe } from '@/hooks/useSwipe';
import { generateSlots } from '@/lib/intervals';
import TimeSlot from './TimeSlot';
import ExportMenu from './ExportMenu';
import TemplateMenu from './TemplateMenu';
import ICSImportButton from './ICSImportButton';
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

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const plannedMinutes = dayTasks.reduce((sum, t) => sum + t.task.durationMins, 0);

  return (
    <section className="df-execution-board">
      <div className="df-execution-hero">
        <div className="df-execution-copy">
          <span className="df-kicker">DAY EXECUTION</span>
          <h2>{format(new Date(date), 'EEEE, MMMM d')}</h2>
          <p>
            {total === 0
              ? 'Your day is open. Drag a task into the timeline to shape it.'
              : `${plannedMinutes} minutes planned · ${done} of ${total} blocks completed.`}
          </p>
        </div>
        <div className="df-execution-score">
          <div className="df-execution-score-value">{completionPct}%</div>
          <div className="df-execution-score-label">day complete</div>
        </div>
      </div>

      <div className="df-execution-progress-wrap">
        <div className="df-execution-progress-meta">
          <span>Daily progress</span>
          <strong>{done}/{total || 0} completed</strong>
        </div>
        <div className="df-execution-progress">
          <span style={{ width: `${completionPct}%` }} />
        </div>
      </div>

      <div className="df-execution-toolbar">
        <div>
          <span className="df-kicker">TIMELINE</span>
          <strong>Plan and execute</strong>
        </div>
        <div className="df-execution-actions">
          <TemplateMenu date={date} />
          <ExportMenu date={date} />
          <ICSImportButton />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="df-execution-timeline"
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
    </section>
  );
}
