import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import TaskForm from '@/components/sidebar/TaskForm';
import { CATEGORY_COLORS } from '@/types';
import type { Task } from '@/types';

const CAT_STORAGE_KEY = 'dayflow-custom-categories';
const ORDER_KEY = 'dayflow-task-order';

// Only load the colorMap from localStorage — categories are derived from tasks directly.
function loadColorMap(): Record<string, string> {
  try {
    const saved = localStorage.getItem(CAT_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as { colorMap?: Record<string, string> };
    return parsed.colorMap ?? {};
  } catch {
    return {};
  }
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function RecurringBadge({ type }: { type: string }) {
  if (type === 'none') return null;
  const labels: Record<string, string> = {
    daily: 'Daily',
    weekdays: 'Weekdays',
    weekly: 'Weekly',
  };
  return (
    <span className="text-[10px] bg-brand-accent/10 text-brand-accent px-1.5 py-0.5 rounded font-medium">
      ↻ {labels[type] ?? type}
    </span>
  );
}

export default function LibraryPage() {
  const { tasks, fetchAll, deleteTask } = useTaskStore();
  const { setView } = useUIStore();

  const [ordered, setOrdered] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [customColorMap, setCustomColorMap] = useState<Record<string, string>>(loadColorMap);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Derive every unique category directly from the actual task list.
  // This guarantees the filter always matches what's in the DB, regardless
  // of what's been saved to localStorage.
  const allCategories = useMemo(() => {
    const seen = new Set<string>();
    // Default four always appear first if any tasks use them
    const defaults = ['work', 'personal', 'health', 'learning'];
    defaults.forEach((c) => {
      if (tasks.some((t) => t.category === c)) seen.add(c);
    });
    // Then append any custom categories found in tasks, preserving insertion order
    tasks.forEach((t) => {
      if (!seen.has(t.category)) seen.add(t.category);
    });
    return [...seen];
  }, [tasks]);

  // Build ordered task list, respecting saved manual order
  useEffect(() => {
    if (tasks.length === 0) {
      setOrdered([]);
      return;
    }
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]');
      if (saved.length > 0) {
        const map = new Map(tasks.map((t) => [t.id, t]));
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

  const refreshColorMap = () => setCustomColorMap(loadColorMap());

  // Resolve a category's display color:
  // 1. task.color (may be a custom override set in TaskForm)
  // 2. built-in CATEGORY_COLORS
  // 3. customColorMap from localStorage
  // 4. fallback blue
  const getColor = (cat: string, taskColor?: string) =>
    taskColor ||
    CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] ||
    customColorMap[cat] ||
    '#4F6EF7';

  const filtered = ordered.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeFilter === 'all' || t.category === activeFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-screen-md mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold dark:text-white">📚 Task Library</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} · drag into the Day view to schedule
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('day')}
            className="text-sm border rounded-lg px-3 py-1.5 dark:text-white dark:border-gray-600 hover:border-brand-accent transition-colors"
          >
            ← Day view
          </button>
          <button
            onClick={() => {
              setEditing(undefined);
              setShowForm(true);
            }}
            className="text-sm bg-brand-accent text-white rounded-lg px-3 py-1.5 font-semibold hover:opacity-90"
          >
            + New task
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-3 mb-4">
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="🔍 Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5">
          {['all', ...allCategories].map((c) => {
            const color = c === 'all' ? '#4F6EF7' : getColor(c);
            return (
              <button
                key={c}
                onClick={() => setActiveFilter(c)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition-all border"
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
      </div>

      {/* Stats row */}
      {filtered.length > 0 && (
        <div className="flex gap-3 mb-3 text-xs text-brand-muted">
          <span>{filtered.length} shown</span>
          <span>·</span>
          <span>{filtered.filter((t) => t.recurring.type !== 'none').length} recurring</span>
          <span>·</span>
          <span>
            avg {Math.round(filtered.reduce((a, t) => a + t.durationMins, 0) / filtered.length)}m
          </span>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-muted">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm font-semibold dark:text-white">
            {tasks.length === 0 ? 'No tasks yet' : 'No matches'}
          </p>
          <p className="text-xs mt-1">
            {tasks.length === 0
              ? 'Create your first task to get started.'
              : 'Try a different search or category filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((task) => {
            const color = getColor(task.category, task.color);
            const isConfirming = confirmDeleteId === task.id;
            return (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm hover:shadow transition-shadow flex items-center gap-3 p-3"
                style={{ borderLeftColor: color, borderLeftWidth: 4 }}
              >
                {/* Color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold dark:text-white truncate">{task.title}</p>
                    <RecurringBadge type={task.recurring.type} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize"
                      style={{ backgroundColor: `${color}25`, color }}
                    >
                      {task.category}
                    </span>
                    <span className="text-xs text-brand-muted">
                      {fmtDuration(task.durationMins)}
                    </span>
                    {task.notes && (
                      <span
                        className="text-xs text-brand-muted truncate max-w-[200px]"
                        title={task.notes}
                      >
                        📝 {task.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditing(task);
                      setShowForm(true);
                    }}
                    className="text-gray-400 hover:text-brand-accent text-sm p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  {isConfirming ? (
                    <>
                      <button
                        onClick={() => {
                          deleteTask(task.id);
                          setConfirmDeleteId(null);
                        }}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded font-semibold"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(task.id)}
                      className="text-gray-400 hover:text-red-400 text-sm p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task form modal */}
      {showForm && (
        <TaskForm
          editing={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(undefined);
            refreshColorMap();
          }}
        />
      )}
    </div>
  );
}
