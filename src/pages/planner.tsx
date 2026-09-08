import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useRecurring } from '@/hooks/useRecurring';
import { useNotifications } from '@/hooks/useNotifications';
import DayView from '@/components/planner/DayView';
import WeekView from '@/components/week/WeekView';
import MonthView from '@/components/month/MonthView';
import TaskLibrary from '@/components/sidebar/TaskLibrary';
import PriorityPanel from '@/components/sidebar/PriorityPanel';
import DateNav from '@/components/planner/DateNav';
import ReflectionPanel from '@/components/planner/ReflectionPanel';
import GlanceBar from '@/components/planner/GlanceBar';
import WorkHoursPanel from '@/components/planner/WorkHoursPanel';
import ReadingStatsWidget from '@/components/documents/ReadingStatsWidget';
import type { DragData, Task, View } from '@/types';

function DragPreview({ data }: { data: DragData }) {
  const task: Task | undefined =
    data.type === 'library-task' ? data.task : data.scheduledTask?.task;
  if (!task) return null;
  return (
    <div
      className="rounded border-l-4 px-3 py-2 text-xs shadow-xl bg-white dark:bg-gray-700 w-48 opacity-95"
      style={{ borderLeftColor: task.color, backgroundColor: `${task.color}18` }}
    >
      <p className="font-semibold text-brand-dark dark:text-white truncate">{task.title}</p>
      <p className="text-brand-muted">
        {task.durationMins}m · {task.category}
      </p>
    </div>
  );
}

const SUB_TABS: { view: 'day' | 'week' | 'month'; label: string; icon: string }[] = [
  { view: 'day', label: 'Day', icon: '📅' },
  { view: 'week', label: 'Week', icon: '📆' },
  { view: 'month', label: 'Month', icon: '🗓' },
];

export default function PlannerPage() {
  const {
    activeView,
    setView,
    selectedDate,
    weekStart,
    activeMonth,
    sidebarOpen,
    toggleSidebar,
    setSidebar,
  } = useUIStore();
  const { scheduledTasks, addTask, updateSlot, fetchByWeek } = usePlannerStore();
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  // The current sub-view — falls back to 'day' if somehow activeView isn't one of the three.
  const subView: 'day' | 'week' | 'month' =
    activeView === 'week' || activeView === 'month' ? activeView : 'day';

  useRecurring(selectedDate);
  useNotifications(selectedDate);

  // ── Week dates ──────────────────────────────────────────────────────────
  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => ({
      date: format(addDays(start, i), 'yyyy-MM-dd'),
      label: format(addDays(start, i), 'EEE d'),
    }));
  }, [weekStart]);

  const goWeek = useCallback(
    (dir: 1 | -1) => {
      const fn = dir === 1 ? addWeeks : subWeeks;
      const next = format(fn(new Date(weekStart), 1), 'yyyy-MM-dd');
      useUIStore.getState().setDate(next);
      useUIStore.setState({ weekStart: next });
    },
    [weekStart]
  );

  // ── Month date ──────────────────────────────────────────────────────────
  const monthDate = useMemo(() => new Date(`${activeMonth}-01`), [activeMonth]);

  const goMonth = useCallback(
    (dir: 1 | -1) => {
      const fn = dir === 1 ? addMonths : subMonths;
      const next = format(fn(monthDate, 1), 'yyyy-MM');
      useUIStore.setState({ activeMonth: next });
    },
    [monthDate]
  );

  useEffect(() => {
    if (subView !== 'month') return;
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    fetchByWeek(start, end);
  }, [activeMonth, subView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (subView !== 'week') return;
    const start = weekDates[0]?.date;
    const end = weekDates[6]?.date;
    if (start && end) fetchByWeek(start, end);
  }, [weekDates, subView]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DnD ─────────────────────────────────────────────────────────────────
  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragData(event.active.data.current as DragData);
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragData(null);
      const { active, over } = event;
      if (!over) return;
      const data = active.data.current as DragData;
      const idStr = over.id.toString();

      if (idStr.startsWith('week-slot-')) {
        const [dateStr, slotStr] = idStr.replace('week-slot-', '').split('::');
        const slot = parseInt(slotStr ?? '', 10);
        if (!dateStr || isNaN(slot)) return;
        if (data.type === 'library-task' && data.task) {
          await addTask(data.task.id, dateStr, slot);
        } else if (data.type === 'scheduled-task' && data.scheduledTask) {
          await updateSlot(data.scheduledTask.id, slot, dateStr);
        }
        return;
      }

      if (idStr.startsWith('slot-')) {
        const slot = parseInt(idStr.replace('slot-', ''), 10);
        if (isNaN(slot)) return;
        if (data.type === 'library-task' && data.task) {
          await addTask(data.task.id, selectedDate, slot);
        } else if (data.type === 'scheduled-task' && data.scheduledTask) {
          await updateSlot(data.scheduledTask.id, slot, selectedDate);
        }
      }
    },
    [selectedDate, addTask, updateSlot]
  );

  const goSubView = (view: 'day' | 'week' | 'month') => setView(view as View);

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="df-page df-planner-page flex gap-4 relative">
        {/* Mobile floating 📚 button — sits above bottom nav */}
        <button
          onClick={toggleSidebar}
          className="fixed z-30 bg-brand-accent2 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl md:hidden"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
            right: '16px',
          }}
        >
          {sidebarOpen ? '✕' : '📚'}
        </button>

        {/* Desktop toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center w-6 shrink-0 text-brand-muted hover:text-brand-accent self-stretch"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        {/* Sidebar — Task Library, shared across Day / Week / Month */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-20 md:hidden"
              onClick={() => setSidebar(false)}
            />
            <div
              className="fixed md:relative top-0 left-0 z-20 md:z-auto w-72 md:w-64 shrink-0 flex flex-col overflow-y-auto"
              style={{
                height: '100%',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 70px)',
              }}
            >
              <div className="hidden md:block shrink-0" style={{ height: '52px' }} />
              <TaskLibrary />
              <div className="mt-4 px-0">
                <WorkHoursPanel date={selectedDate} />
              </div>
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <section className="df-planner-hero">
            <div>
              <span className="df-kicker">PLANNING WORKSPACE</span>
              <h2>Make the day visible before you start moving through it.</h2>
              <p>Switch between execution, weekly capacity, and monthly context without losing your task library.</p>
            </div>
            <button className="df-planner-library-toggle" onClick={toggleSidebar}>
              <span>▦</span><div><b>{sidebarOpen ? 'Hide library' : 'Open library'}</b><small>Reusable tasks & work hours</small></div>
            </button>
          </section>

          {/* Planner sub-nav: Day / Week / Month */}
          <div className="df-planner-viewbar">
            <div className="df-segmented shrink-0">
            {SUB_TABS.map(({ view, label, icon }) => (
              <button
                key={view}
                onClick={() => goSubView(view)}
                className={subView === view ? 'is-active' : ''}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
            </div>
            <span className="df-chip is-blue">{subView === 'day' ? 'Execution' : subView === 'week' ? 'Capacity' : 'Context'}</span>
          </div>

          {subView === 'day' && (
            <div className="df-planner-day-layout">
              <div className="df-planner-day-main">
                <DateNav />
                <GlanceBar date={selectedDate} />
                <DayView date={selectedDate} scheduledTasks={scheduledTasks} />
              </div>
              <aside className="df-planner-day-rail">
                <PriorityPanel />
                <ReadingStatsWidget />
                <ReflectionPanel date={selectedDate} />
              </aside>
            </div>
          )}

          {subView === 'week' && (
            <div className="df-planner-period-view">
              {/* Week nav */}
              <div className="df-period-nav">
                <button
                  onClick={() => goWeek(-1)}
                  className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600 hover:border-brand-accent transition-colors"
                >
                  ← Prev
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const thisWeek = format(
                        startOfWeek(new Date(), { weekStartsOn: 1 }),
                        'yyyy-MM-dd'
                      );
                      useUIStore.getState().setDate(thisWeek);
                      useUIStore.setState({ weekStart: thisWeek });
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors
                      ${
                        weekStart === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
                          ? 'bg-brand-accent text-white'
                          : 'border dark:border-gray-600 dark:text-white hover:border-brand-accent'
                      }`}
                  >
                    This week
                  </button>
                  <span className="font-semibold text-sm dark:text-white hidden sm:block">
                    {format(new Date(weekStart), 'MMM d, yyyy')}
                  </span>
                </div>

                <button
                  onClick={() => goWeek(1)}
                  className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600 hover:border-brand-accent transition-colors"
                >
                  Next →
                </button>
              </div>
              <WeekView weekDates={weekDates} scheduledTasks={scheduledTasks} fetchByWeek={fetchByWeek} />
            </div>
          )}

          {subView === 'month' && (
            <div className="df-planner-period-view">
              {/* Month nav */}
              <div className="df-period-nav">
                <button
                  onClick={() => goMonth(-1)}
                  className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600"
                >
                  ← Prev
                </button>
                <span className="font-semibold text-sm dark:text-white">
                  {format(monthDate, 'MMMM yyyy')}
                </span>
                <button
                  onClick={() => goMonth(1)}
                  className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600"
                >
                  Next →
                </button>
              </div>
              <MonthView monthDate={monthDate} scheduledTasks={scheduledTasks} />
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragData && <DragPreview data={activeDragData} />}
      </DragOverlay>
    </DndContext>
  );
}
