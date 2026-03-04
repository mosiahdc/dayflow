import { useCallback, useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useRecurring } from '@/hooks/useRecurring';
import DayView from '@/components/planner/DayView';
import TaskLibrary from '@/components/sidebar/TaskLibrary';
import PriorityPanel from '@/components/sidebar/PriorityPanel';
import HabitTracker from '@/components/habits/HabitTracker';
import DateNav from '@/components/planner/DateNav';
import ReflectionPanel from '@/components/planner/ReflectionPanel';
import type { DragData, Task, ScheduledTask } from '@/types';

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

        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="fixed bottom-4 left-4 z-30 bg-brand-accent2 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg md:hidden"
          title="Toggle Task Library"
        >
          {sidebarOpen ? '✕' : '📚'}
        </button>

        {/* Desktop toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center w-6 shrink-0 text-brand-muted hover:text-brand-accent self-stretch"
          title="Toggle sidebar"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            {/* Mobile overlay */}
            <div
              className="fixed inset-0 bg-black/50 z-20 md:hidden"
              onClick={() => setSidebar(false)}
            />
            <div
              className={`
                fixed md:relative top-0 left-0 h-full md:h-auto z-20 md:z-auto
                w-72 md:w-64 shrink-0
                md:block
              `}
              style={{ height: 'calc(100vh - 80px)' }}
            >
              <TaskLibrary />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <DateNav />

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <DayView date={selectedDate} scheduledTasks={scheduledTasks} />
            </div>
            <div className="lg:w-72 shrink-0 flex flex-col gap-4">
              <PriorityPanel />
              <ReflectionPanel date={selectedDate} />
            </div>
          </div>

          <HabitTracker />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragData && <DragPreview data={activeDragData} />}
      </DragOverlay>
    </DndContext>
  );
}