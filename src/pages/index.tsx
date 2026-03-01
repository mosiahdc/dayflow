import { useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import DayView from '@/components/planner/DayView';
import TaskLibrary from '@/components/sidebar/TaskLibrary';
import PriorityPanel from '@/components/sidebar/PriorityPanel';
import HabitTracker from '@/components/habits/HabitTracker';
import DateNav from '@/components/planner/DateNav';
import ReflectionPanel from '@/components/planner/ReflectionPanel';
import type { DragData, Task, ScheduledTask } from '@/types';

function DragPreview({ data }: { data: DragData }) {
  const task: Task | undefined = data.type === 'library-task'
    ? data.task
    : data.scheduledTask?.task;
  if (!task) return null;
  return (
    <div
      className="rounded border-l-4 px-3 py-2 text-xs shadow-xl bg-white dark:bg-gray-700 w-48 opacity-95"
      style={{ borderLeftColor: task.color, backgroundColor: `${task.color}18` }}
    >
      <p className="font-semibold text-brand-dark dark:text-white truncate">{task.title}</p>
      <p className="text-brand-muted">{task.durationMins}m · {task.category}</p>
    </div>
  );
}

export default function DayPage() {
  const { selectedDate } = useUIStore();
  const { scheduledTasks, addTask, updateSlot } = usePlannerStore();
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragData(event.active.data.current as DragData);
  }, []);

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;
    const data    = active.data.current as DragData;
    const slotStr = over.id.toString().replace('slot-', '');
    const slot    = parseInt(slotStr, 10);
    if (isNaN(slot)) return;
    if (data.type === 'library-task' && data.task) {
      await addTask(data.task.id, selectedDate, slot);
    } else if (data.type === 'scheduled-task' && data.scheduledTask) {
      await updateSlot(data.scheduledTask.id, slot, selectedDate);
    }
  }, [selectedDate, addTask, updateSlot]);

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="max-w-screen-xl mx-auto flex gap-4">
        {/* Sidebar */}
        <div className="w-64 shrink-0" style={{ height: 'calc(100vh - 80px)' }}>
          <TaskLibrary />
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col gap-4">
          <DateNav />
          <div className="flex gap-4">
            <div className="flex-1">
              <DayView date={selectedDate} scheduledTasks={scheduledTasks} />
            </div>
            <div className="w-72 shrink-0 flex flex-col gap-4">
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