import { useEffect, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTaskStore } from '@/store/taskStore';
import TaskForm from './TaskForm';
import { CATEGORY_COLORS } from '@/types';
import type { Category, Task } from '@/types';

const DEFAULT_CATEGORIES = ['work', 'personal', 'health', 'learning'];
const CAT_STORAGE_KEY = 'dayflow-custom-categories';

function loadAllCategories(): { categories: string[]; colorMap: Record<string, string> } {
  try {
    const saved = localStorage.getItem(CAT_STORAGE_KEY);
    if (!saved) return { categories: DEFAULT_CATEGORIES, colorMap: {} };
    const parsed = JSON.parse(saved) as { categories: string[]; colorMap: Record<string, string> };
    return {
      categories: parsed.categories ?? DEFAULT_CATEGORIES,
      colorMap: parsed.colorMap ?? {},
    };
  } catch {
    return { categories: DEFAULT_CATEGORIES, colorMap: {} };
  }
}

function DraggableTaskCard({
  task,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
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
      className={`rounded border-l-4 px-2 py-1.5 shadow-sm select-none group
        cursor-grab active:cursor-grabbing
        bg-white dark:bg-gray-700
        ${isDragging ? 'opacity-40 z-50' : 'hover:brightness-95 dark:hover:brightness-110 transition-all'}`}
      style={{ borderLeftColor: task.color, backgroundColor: `${task.color}18` }}
    >
      <div className="flex items-center gap-1">
        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brand-dark dark:text-white truncate leading-tight">
            {task.title}
          </p>
          <p className="text-[10px] text-brand-muted capitalize leading-tight">
            {task.category} · {task.durationMins}m
          </p>
        </div>

        {/* Action buttons — visible on hover */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Move up/down arrows — side by side */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="text-gray-400 hover:text-brand-accent disabled:opacity-20 text-xs px-1 py-0.5 rounded"
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="text-gray-400 hover:text-brand-accent disabled:opacity-20 text-xs px-1 py-0.5 rounded"
              title="Move down"
            >
              ▼
            </button>
          </div>

          {/* Edit */}
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-brand-accent text-xs p-0.5 rounded"
            title="Edit"
          >
            ✏️
          </button>

          {/* Delete */}
          {confirmDelete ? (
            <>
              <button
                onClick={onDelete}
                className="text-[10px] bg-red-500 text-white px-1 py-0.5 rounded font-semibold"
              >
                Del
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-gray-400 hover:text-gray-600 px-0.5"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-400 hover:text-red-400 text-xs p-0.5 rounded"
              title="Delete"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const LIBRARY_HEIGHT = 568;

export default function TaskLibrary() {
  const { tasks, fetchAll, deleteTask } = useTaskStore();
  const [ordered, setOrdered] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [allCategories, setAllCategories] = useState<string[]>(
    () => loadAllCategories().categories
  );
  const [customColorMap, setCustomColorMap] = useState<Record<string, string>>(
    () => loadAllCategories().colorMap
  );

  // Refresh categories when TaskForm adds a new one
  const refreshCategories = () => {
    const { categories, colorMap } = loadAllCategories();
    setAllCategories(categories);
    setCustomColorMap(colorMap);
  };

  const STORAGE_KEY = 'dayflow-task-order';

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // When tasks load from DB, apply saved order if available
  useEffect(() => {
    if (tasks.length === 0) {
      setOrdered([]);
      return;
    }
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (saved.length > 0) {
        const map = new Map(tasks.map((t) => [t.id, t]));
        // Put saved-order tasks first, then any new tasks not yet in saved order
        const reordered = [
          ...(saved.map((id) => map.get(id)).filter(Boolean) as Task[]),
          ...tasks.filter((t) => !saved.includes(t.id)),
        ];
        setOrdered(reordered);
      } else {
        setOrdered(tasks);
      }
    } catch {
      setOrdered(tasks);
    }
  }, [tasks]);

  const filtered = ordered.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeFilter === 'all' || t.category === activeFilter;
    return matchSearch && matchCategory;
  });

  function moveTask(id: string, dir: 1 | -1) {
    setOrdered((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((t) => t.id)));
      return next;
    });
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl border shadow flex flex-col"
      style={{ height: `${LIBRARY_HEIGHT}px` }}
    >
      {/* Header */}
      <div className="bg-brand-accent2 text-white px-3 py-2 rounded-t-xl flex justify-between items-center shrink-0">
        <span className="font-semibold text-sm">📚 Task Library</span>
        <button
          onClick={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
          className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded"
        >
          + New
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b dark:border-gray-700 shrink-0">
        <input
          className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="🔍 Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 px-2 py-1.5 border-b dark:border-gray-700 shrink-0 flex-wrap">
        {['all', ...allCategories].map((c) => {
          const color =
            c === 'all'
              ? '#4F6EF7'
              : (CATEGORY_COLORS[c as keyof typeof CATEGORY_COLORS] ??
                customColorMap[c] ??
                '#4F6EF7');
          return (
            <button
              key={c}
              onClick={() => {
                setActiveFilter(c);
                refreshCategories();
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize transition-all border"
              style={{
                borderColor: color,
                backgroundColor: activeFilter === c ? color : undefined,
                color: activeFilter === c ? 'white' : undefined,
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Sortable task list */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-brand-muted text-center mt-4">
            {tasks.length === 0 ? 'No tasks yet. Create one!' : 'No matches.'}
          </p>
        )}
        <div className="flex flex-col gap-1">
          {filtered.map((task, i) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onEdit={() => {
                setEditing(task);
                setShowForm(true);
              }}
              onDelete={() => {
                deleteTask(task.id);
              }}
              onMoveUp={() => moveTask(task.id, -1)}
              onMoveDown={() => moveTask(task.id, 1)}
              isFirst={i === 0}
              isLast={i === filtered.length - 1}
            />
          ))}
        </div>
      </div>

      {showForm && (
        <TaskForm
          editing={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(undefined);
            refreshCategories(); // pick up any newly added categories
          }}
        />
      )}
    </div>
  );
}
