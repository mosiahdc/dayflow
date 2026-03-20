import { useEffect, useMemo, useCallback } from 'react';
import { format, addDays, addWeeks, subWeeks } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { generateSlots } from '@/lib/intervals';
import WeekTaskBlock from './WeekTaskBlock';
import { useUIStore } from '@/store/uiStore';
import { useSwipe } from '@/hooks/useSwipe';
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
      {scheduledTasks.map((st, i) => (
        <WeekTaskBlock key={st.id} scheduledTask={st} index={i} total={scheduledTasks.length} />
      ))}
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

  const { setDate } = useUIStore();

  const goWeek = useCallback(
    (dir: 1 | -1) => {
      const fn = dir === 1 ? addWeeks : subWeeks;
      const current = start ? new Date(start) : new Date();
      const next = format(fn(current, 1), 'yyyy-MM-dd');
      setDate(next);
      useUIStore.setState({ weekStart: next });
    },
    [start, setDate]
  );

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => goWeek(1),
    onSwipeRight: () => goWeek(-1),
    threshold: 60,
    maxVertical: 80,
  });

  useEffect(() => {
    if (start && end) fetchByWeek(start, end);
  }, [start, end, fetchByWeek]);

  // Build a map of date → tasks including overflow continuations from previous day
  const tasksByDate = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();

    for (const { date } of weekDates) map.set(date, []);

    for (const st of scheduledTasks) {
      if (map.has(st.date)) map.get(st.date)!.push(st);
    }

    // Inject overflow continuations
    for (const st of scheduledTasks) {
      const overflowSlots = st.startSlot + st.task.durationMins / 30 - 48;
      if (overflowSlots <= 0) continue;

      const stDateIdx = weekDates.findIndex((d) => d.date === st.date);
      if (stDateIdx === -1 || stDateIdx >= weekDates.length - 1) continue;

      const nextDate = weekDates[stDateIdx + 1]!.date;
      const remainingMins = overflowSlots * 30;

      const continuation: ScheduledTask = {
        ...st,
        id: `overflow-${st.id}`,
        date: nextDate,
        startSlot: 0,
        task: {
          ...st.task,
          durationMins: remainingMins,
          title: `↩ ${st.task.title} (cont.)`,
        },
      };
      map.get(nextDate)!.unshift(continuation);
    }

    return map;
  }, [scheduledTasks, weekDates]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
      {/* Day headers */}
      <div
        className="grid sticky top-0 z-20 bg-white dark:bg-gray-800 border-b dark:border-gray-700"
        style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
      >
        <div className="border-r dark:border-gray-700" />
        {weekDates.map(({ date, label }) => (
          <div
            key={date}
            className={`text-center text-xs font-semibold py-2 border-r dark:border-gray-700
              ${date === today ? 'bg-brand-accent text-white' : 'dark:text-white'}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '75vh' }} {...swipeHandlers}>
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
                scheduledTasks={(tasksByDate.get(date) ?? []).filter(
                  (t) => t.startSlot === slot.index
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
