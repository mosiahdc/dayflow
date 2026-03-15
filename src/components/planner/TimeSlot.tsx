import { memo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { usePlannerStore } from '@/store/plannerStore';
import { useTaskStore } from '@/store/taskStore';
import { CATEGORY_COLORS } from '@/types';
import TaskCard from './TaskCard';
import TaskForm from '@/components/sidebar/TaskForm';
import type { TaskLayout } from './DayView';
import type { Task } from '@/types';

interface Props {
  slot: { index: number; label: string };
  date: string;
  taskLayouts: TaskLayout[];
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

// Mini picker shown when clicking + on a slot
function SlotTaskPicker({
  onClose,
  onPick,
  onCreateNew,
}: {
  onClose: () => void;
  onPick: (taskId: string) => void;
  onCreateNew: () => void;
}) {
  const { tasks } = useTaskStore();
  const [search, setSearch] = useState('');

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

  const getColor = (task: Task) =>
    CATEGORY_COLORS[task.category as keyof typeof CATEGORY_COLORS] ?? task.color ?? '#4F6EF7';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 shrink-0">
          <span className="font-semibold text-sm dark:text-white">Add to this slot</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b dark:border-gray-700 shrink-0">
          <input
            autoFocus
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="🔍 Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No tasks found.</p>
          )}
          {filtered.map((task) => (
            <button
              key={task.id}
              onClick={() => onPick(task.id)}
              className="flex items-center gap-3 p-2.5 rounded-lg border dark:border-gray-700
                hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left w-full"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: getColor(task) }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold dark:text-white truncate">{task.title}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {task.category} · {task.durationMins}m
                </p>
              </div>
              <span className="text-xs text-gray-300 shrink-0">+ Add</span>
            </button>
          ))}
        </div>

        {/* Create new task option */}
        <div className="px-3 py-3 border-t dark:border-gray-700 shrink-0">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed
              border-gray-300 dark:border-gray-600 text-sm text-gray-400 dark:text-gray-400
              hover:border-brand-accent hover:text-brand-accent transition-colors"
          >
            + Create new task
          </button>
        </div>
      </div>
    </div>
  );
}

const TimeSlot = memo(function TimeSlot({ slot, date, taskLayouts, onRemove, onToggle }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot.index}` });
  const { addTask } = usePlannerStore();
  const [showPicker, setShowPicker] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handlePick = async (taskId: string) => {
    await addTask(taskId, date, slot.index);
    setShowPicker(false);
  };

  const handleSave = async (taskId: string) => {
    await addTask(taskId, date, slot.index);
    setShowForm(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex border-b border-brand-border min-h-[40px] relative transition-colors group
        ${isOver ? 'bg-brand-accent/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
    >
      <span className="w-20 text-xs text-brand-muted px-2 py-1 shrink-0 select-none whitespace-nowrap">
        {slot.label}
      </span>
      <div className="flex-1 relative">
        {taskLayouts.map((layout) => (
          <TaskCard
            key={layout.scheduledTask.id}
            scheduledTask={layout.scheduledTask}
            col={layout.col}
            totalCols={layout.totalCols}
            onRemove={onRemove}
            onToggle={onToggle}
          />
        ))}
      </div>

      {/* + button always visible on hover for every slot */}
      {!showPicker && !showForm && (
        <button
          onClick={() => setShowPicker(true)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center
            rounded text-gray-500 dark:text-gray-400 hover:text-white hover:bg-brand-accent
            transition-colors z-20 text-base font-bold"
          title="Add task to this slot"
        >
          +
        </button>
      )}

      {showPicker && (
        <SlotTaskPicker
          onClose={() => setShowPicker(false)}
          onPick={handlePick}
          onCreateNew={() => {
            setShowPicker(false);
            setShowForm(true);
          }}
        />
      )}

      {showForm && <TaskForm onClose={() => setShowForm(false)} onSave={handleSave} />}
    </div>
  );
});

export default TimeSlot;
