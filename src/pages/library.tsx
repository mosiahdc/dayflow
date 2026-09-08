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

  const recurringCount = filtered.filter((t) => t.recurring.type !== 'none').length;
  const avgDuration = filtered.length ? Math.round(filtered.reduce((a, t) => a + t.durationMins, 0) / filtered.length) : 0;

  return (
    <div className="df-page df-task-library-page df-library-workspace">
      <section className="df-library-hero">
        <div>
          <span className="df-kicker">REUSABLE BUILDING BLOCKS</span>
          <h2>Build the task once. Schedule it whenever you need it.</h2>
          <p>Keep recurring routines, work blocks, and one-off templates organized before dragging them into Planner.</p>
        </div>
        <div className="df-inline-actions">
          <button className="df-btn df-btn-secondary" onClick={() => setView('day')}>Open Planner</button>
          <button className="df-btn df-btn-primary" onClick={() => { setEditing(undefined); setShowForm(true); }}>+ New task</button>
        </div>
      </section>

      <section className="df-library-kpis">
        <div><span>Total tasks</span><strong>{tasks.length}</strong><small>saved blocks</small></div>
        <div><span>Shown</span><strong>{filtered.length}</strong><small>current filter</small></div>
        <div><span>Recurring</span><strong>{recurringCount}</strong><small>automatic routines</small></div>
        <div><span>Average block</span><strong>{avgDuration ? fmtDuration(avgDuration) : '—'}</strong><small>typical duration</small></div>
      </section>

      <section className="df-library-commandbar">
        <div className="df-library-search">
          <span>⌕</span>
          <input placeholder="Search by task name…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="df-library-filters">
          {['all', ...allCategories].map((c) => {
            const color = c === 'all' ? 'var(--df-accent)' : getColor(c);
            return (
              <button key={c} onClick={() => setActiveFilter(c)} className={activeFilter === c ? 'is-active' : ''} style={{ '--task-color': color } as React.CSSProperties}>
                <span style={{ background: color }} />{c}
              </button>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="df-empty-state">
          <span style={{ fontSize: 30 }}>▦</span>
          <strong>{tasks.length === 0 ? 'Create your first reusable task.' : 'No tasks match this view.'}</strong>
          <p>{tasks.length === 0 ? 'Once created, tasks can be dragged into Planner again and again.' : 'Try another category or clear the search.'}</p>
        </div>
      ) : (
        <section className="df-library-grid">
          {filtered.map((task) => {
            const color = getColor(task.category, task.color);
            const isConfirming = confirmDeleteId === task.id;
            return (
              <article key={task.id} className="df-library-task-card" style={{ '--task-color': color } as React.CSSProperties}>
                <div className="df-library-task-accent" />
                <div className="df-library-task-head">
                  <span className="df-library-task-category" style={{ color }}>{task.category}</span>
                  <RecurringBadge type={task.recurring.type} />
                </div>
                <h3>{task.title}</h3>
                <p>{task.notes || 'No notes added for this task.'}</p>
                <div className="df-library-task-meta">
                  <span><b>{fmtDuration(task.durationMins)}</b> duration</span>
                  <span><b>{task.recurring.type === 'none' ? 'Manual' : 'Auto'}</b> scheduling</span>
                </div>
                <div className="df-library-task-actions">
                  <button className="df-btn df-btn-secondary" onClick={() => { setEditing(task); setShowForm(true); }}>Edit</button>
                  {isConfirming ? (
                    <>
                      <button className="df-btn" style={{ background: 'var(--df-red)', color: '#fff', borderColor: 'var(--df-red)' }} onClick={() => { deleteTask(task.id); setConfirmDeleteId(null); }}>Confirm delete</button>
                      <button className="df-icon-button" onClick={() => setConfirmDeleteId(null)}>×</button>
                    </>
                  ) : (
                    <button className="df-icon-button" onClick={() => setConfirmDeleteId(task.id)} title="Delete task">🗑</button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

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
