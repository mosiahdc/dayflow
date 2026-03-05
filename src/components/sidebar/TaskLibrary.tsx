import { useEffect, useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import TaskForm from './TaskForm';
import { CATEGORY_COLORS } from '@/types';
import type { Category, Task } from '@/types';
import { useDraggable } from '@dnd-kit/core';

const CATEGORIES: Category[] = ['work', 'personal', 'health', 'learning'];

function DraggableTaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${task.id}`,
    data: { type: 'library-task', task },
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`bg-white dark:bg-gray-700 rounded-lg border-l-4 p-3 shadow-sm
        cursor-grab active:cursor-grabbing select-none group
        ${isDragging ? 'opacity-40' : 'hover:shadow-md transition-shadow'}`}
      style={{ borderLeftColor: task.color }}
    >
      <div className="flex justify-between items-start gap-1">
        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-dark dark:text-white truncate">
            {task.title}
          </p>
          <p className="text-xs text-brand-muted mt-0.5 capitalize">
            {task.category} · {task.durationMins}m
          </p>
        </div>

        {/* Action buttons — visible on hover */}
        <div
          className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Edit */}
          <button
            onClick={onEdit}
            className="text-gray-300 hover:text-brand-accent text-xs p-0.5 rounded"
            title="Edit task"
          >
            ✏️
          </button>

          {/* Delete — two-step confirm */}
          {confirmDelete ? (
            <>
              <button
                onClick={onDelete}
                className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold"
                title="Confirm delete"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-400 hover:text-gray-600 px-1 py-0.5"
                title="Cancel"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-300 hover:text-red-400 text-xs p-0.5 rounded"
              title="Delete task"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskLibrary() {
  const { tasks, fetchAll, deleteTask } = useTaskStore();
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState<Task | undefined>();
  const [search,       setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState<Category | 'all'>('all');

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = tasks.filter((t) => {
    const matchSearch   = t.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeFilter === 'all' || t.category === activeFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow flex flex-col h-full">
      {/* Header */}
      <div className="bg-brand-accent2 text-white px-4 py-2 rounded-t-xl flex justify-between items-center">
        <span className="font-semibold text-sm">Task Library</span>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
        >
          + New
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b dark:border-gray-700">
        <input
          className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="🔍 Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 px-3 py-2 border-b dark:border-gray-700">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActiveFilter(c)}
            className="px-2 py-0.5 rounded text-xs font-semibold capitalize transition-all border"
            style={{
              borderColor:     c === 'all' ? '#4F6EF7' : CATEGORY_COLORS[c],
              backgroundColor: activeFilter === c ? (c === 'all' ? '#4F6EF7' : CATEGORY_COLORS[c]) : undefined,
              color:           activeFilter === c ? 'white' : undefined,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="text-xs text-brand-muted text-center mt-4">
            {tasks.length === 0 ? 'No tasks yet. Create one!' : 'No matches.'}
          </p>
        )}
        {filtered.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            onEdit={() => { setEditing(task); setShowForm(true); }}
            onDelete={() => deleteTask(task.id)}
          />
        ))}
      </div>

      {showForm && (
        <TaskForm
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}