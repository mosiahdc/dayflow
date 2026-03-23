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
      className={`rounded select-none group cursor-grab active:cursor-grabbing transition-all
        ${isDragging ? 'opacity-40 z-50' : ''}`}
      style={{
        borderLeft: `3px solid ${task.color}`,
        backgroundColor: `${task.color}1a`,
        padding: '6px 8px',
      }}
    >
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-tight text-white">
            {task.title}
          </p>
          <p className="text-[10px] capitalize leading-tight" style={{ color: 'var(--df-muted)' }}>
            {task.category} · {task.durationMins}m
          </p>
        </div>

        <div
          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="text-xs px-1 py-0.5 rounded disabled:opacity-20 transition-colors"
              style={{ color: 'var(--df-muted)' }}
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="text-xs px-1 py-0.5 rounded disabled:opacity-20 transition-colors"
              style={{ color: 'var(--df-muted)' }}
              title="Move down"
            >
              ▼
            </button>
          </div>

          <button
            onClick={onEdit}
            className="text-xs p-0.5 rounded transition-colors"
            style={{ color: 'var(--df-muted)' }}
            title="Edit"
          >
            ✏️
          </button>

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
                className="text-[10px] px-0.5"
                style={{ color: 'var(--df-muted)' }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs p-0.5 rounded transition-colors"
              style={{ color: 'var(--df-muted)' }}
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
  const [customColorMap, setCustomColorMap] = useState<Record<string, string>>(
    () => loadAllCategories().colorMap
  );

  // Derive categories from actual tasks + defaults, so DB categories always appear
  const allCategories = (() => {
    const fromTasks = tasks.map(t => t.category as string);
    const merged = [...DEFAULT_CATEGORIES, ...fromTasks];
    // Deduplicate preserving order
    return merged.filter((c, i) => merged.indexOf(c) === i);
  })();

  // Refresh custom color map when TaskForm adds a new category
  const refreshCategories = () => {
    const { colorMap } = loadAllCategories();
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
      className="rounded-xl flex flex-col"
      style={{
        height: `${LIBRARY_HEIGHT}px`,
        background: 'var(--df-surface)',
        border: '1px solid var(--df-border)',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 rounded-t-xl flex justify-between items-center shrink-0"
        style={{ background: 'var(--df-accent)', borderBottom: '1px solid var(--df-border)' }}
      >
        <span className="font-semibold text-sm text-white">📚 Task Library</span>
        <button
          onClick={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
          className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition-colors"
        >
          + New
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--df-border)' }}>
        <input
          className="w-full rounded px-2 py-1 text-xs text-white outline-none"
          style={{
            background: 'var(--df-surface2)',
            border: '1px solid var(--df-border)',
          }}
          placeholder="🔍 Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      <div
        className="flex gap-1 px-2 py-1.5 shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid var(--df-border)' }}
      >
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
                backgroundColor: activeFilter === c ? color : 'transparent',
                color: activeFilter === c ? 'white' : 'var(--df-muted)',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-center mt-4" style={{ color: 'var(--df-muted)' }}>
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
            refreshCategories();
          }}
        />
      )}
    </div>
  );
}
