import { useCallback, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useRecurring } from '@/hooks/useRecurring';
import { useNotifications } from '@/hooks/useNotifications';
import DayView from '@/components/planner/DayView';
import TaskLibrary from '@/components/sidebar/TaskLibrary';
import PriorityPanel from '@/components/sidebar/PriorityPanel';
import DateNav from '@/components/planner/DateNav';
import ReflectionPanel from '@/components/planner/ReflectionPanel';
import GlanceBar from '@/components/planner/GlanceBar';
import ReadingStatsWidget from '@/components/documents/ReadingStatsWidget';
import type { DragData, Task } from '@/types';

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

export default function DayPage() {
  const { selectedDate, sidebarOpen, toggleSidebar, setSidebar } = useUIStore();
  const { scheduledTasks, addTask, updateSlot } = usePlannerStore();
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  useRecurring(selectedDate);
  useNotifications(selectedDate);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragData(event.active.data.current as DragData);
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragData(null);
      const { active, over } = event;
      if (!over) return;
      const data = active.data.current as DragData;
      const slotStr = over.id.toString().replace('slot-', '');
      const slot = parseInt(slotStr, 10);
      if (isNaN(slot)) return;
      if (data.type === 'library-task' && data.task) {
        await addTask(data.task.id, selectedDate, slot);
      } else if (data.type === 'scheduled-task' && data.scheduledTask) {
        await updateSlot(data.scheduledTask.id, slot, selectedDate);
      }
    },
    [selectedDate, addTask, updateSlot]
  );

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="max-w-screen-xl mx-auto flex gap-4 relative">
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

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-20 md:hidden"
              onClick={() => setSidebar(false)}
            />
            <div
              className="fixed md:relative top-0 left-0 z-20 md:z-auto w-72 md:w-64 shrink-0 flex flex-col"
              style={{
                height: '100%',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 70px)',
              }}
            >
              {/* Spacer to align TaskLibrary top with DayView (DateNav height + gap) */}
              <div className="hidden md:block shrink-0" style={{ height: '60px' }} />
              <TaskLibrary />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: DateNav + DayView stacked */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <DateNav />
              <GlanceBar date={selectedDate} />
              <DayView date={selectedDate} scheduledTasks={scheduledTasks} />
            </div>

            {/* Right: spacer + Priority + Reflection — spacer matches DateNav height */}
            <div className="lg:w-72 shrink-0 flex flex-col gap-4">
              <div className="hidden lg:block shrink-0" style={{ height: '60px' }} />
              <PriorityPanel />
              <ReadingStatsWidget />
              <ReflectionPanel date={selectedDate} />
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragData && <DragPreview data={activeDragData} />}
      </DragOverlay>
    </DndContext>
  );
}
