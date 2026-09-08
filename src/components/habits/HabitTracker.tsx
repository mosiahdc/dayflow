import { useEffect, useState, useMemo } from 'react';
import { format, startOfWeek, addDays, subDays } from 'date-fns';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHabitStore } from '@/store/habitStore';
import { useUIStore } from '@/store/uiStore';
import HabitForm from './HabitForm';
import type { Habit, HabitEntry, DayOfWeek } from '@/types';

const DAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt12(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

// ── Sortable habit row ─────────────────────────────────────────────────────
function SortableHabitRow({
  habit,
  entries,
  allEntries,
  dates,
  onToggle,
  onSkip,
  onDelete,
  onEdit,
}: {
  habit: Habit;
  entries: HabitEntry[];
  allEntries: HabitEntry[];
  dates: { date: string; day: DayOfWeek; label: string }[];
  onToggle: (habitId: string, date: string) => void;
  onSkip: (habitId: string, date: string) => void;
  onDelete: (id: string) => void;
  onEdit: (habit: Habit) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const streak = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    let current = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dayKey = DAY_KEYS[current.getDay() % 7]!;
      const dateStr = format(current, 'yyyy-MM-dd');
      if (habit.targetDays.includes(dayKey)) {
        const entry = allEntries.find(
          (e) => e.habitId === habit.id && e.date === dateStr && e.completed
        );
        if (entry) {
          count++;
        } else if (dateStr < format(today, 'yyyy-MM-dd')) {
          break;
        }
      }
      current = subDays(current, 1);
    }
    return count;
  }, [allEntries, habit]);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderBottom: '1px solid var(--df-border)' }}
      className={`df-habit-row min-w-[560px] transition-colors ${isDragging ? 'opacity-40 z-50' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing shrink-0 text-base leading-none"
          style={{ color: 'var(--df-border2)' }}
        >
          ⠿
        </div>

        {/* Color stripe + name */}
        <div className="flex items-center gap-2 w-44 shrink-0">
          <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--df-text)' }}>{habit.title}</p>
            <p className="text-xs capitalize" style={{ color: 'var(--df-muted)' }}>
              {habit.category}
            </p>
          </div>
        </div>

        {/* Day checkboxes */}
        <div className="flex gap-2 flex-1 justify-center">
          {dates.map(({ date, day }) => {
            const entry = entries.find((e) => e.habitId === habit.id && e.date === date);
            const completed = entry?.completed ?? false;
            const isTarget = habit.targetDays.includes(day);
            const today = format(new Date(), 'yyyy-MM-dd');
            const isPast = date < today;
            const skipEntry = entries.find(
              (e) => e.habitId === habit.id && e.date === date && !e.completed && e.skipReason
            );
            return (
              <div
                key={date}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
              >
                <button
                  onClick={() => {
                    if (!isTarget) return;
                    onToggle(habit.id, date);
                  }}
                  className="df-habit-check w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    opacity: !isTarget ? 0.2 : 1,
                    cursor: !isTarget ? 'default' : 'pointer',
                    borderColor: completed
                      ? 'var(--df-green)'
                      : skipEntry
                        ? 'var(--df-amber)'
                        : 'var(--df-border2)',
                    background: completed ? 'var(--df-green)' : 'transparent',
                    color: completed ? '#fff' : 'transparent',
                  }}
                >
                  {completed ? (
                    '✓'
                  ) : skipEntry ? (
                    <span style={{ fontSize: 8, color: 'var(--df-amber)' }}>!</span>
                  ) : null}
                </button>
                {/* Skip reason button — only on past uncompleted target days */}
                {isTarget && isPast && !completed && (
                  <button
                    onClick={() => onSkip(habit.id, date)}
                    title={skipEntry ? `Reason: ${skipEntry.skipReason}` : 'Add skip reason'}
                    style={{
                      fontSize: 7,
                      lineHeight: 1,
                      padding: '1px 3px',
                      borderRadius: 3,
                      border: 'none',
                      cursor: 'pointer',
                      background: skipEntry ? 'rgba(245,158,11,0.15)' : 'rgba(136,136,153,0.15)',
                      color: skipEntry ? 'var(--df-amber)' : 'var(--df-muted)',
                    }}
                  >
                    {skipEntry ? '✎' : '?'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Streak */}
        <div className="w-12 text-center shrink-0">
          {streak > 0 ? (
            <span className="text-xs font-bold" style={{ color: 'var(--df-amber)' }}>
              {streak} 🔥
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--df-muted)' }}>
              —
            </span>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={() => onEdit(habit)}
          className="df-icon-control text-sm shrink-0 transition-colors"
          style={{ color: 'var(--df-muted)' }}
          title="Edit habit"
        >
          ✏️
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(habit.id)}
          className="df-icon-control text-sm shrink-0 transition-colors"
          style={{ color: 'var(--df-border2)' }}
          title="Delete habit"
        >
          ×
        </button>
      </div>

      {/* Reminder strip — shown below row if set */}
      {habit.reminderTime && (
        <div className="flex items-center gap-1.5 px-10 pb-1.5">
          <span className="text-[10px]">🔔</span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: habit.color }}
          >
            {fmt12(habit.reminderTime)}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
            on target days
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main HabitTracker ──────────────────────────────────────────────────────
export default function HabitTracker() {
  const { selectedDate } = useUIStore();
  const {
    habits,
    entries,
    weekEntries,
    fetchHabits,
    fetchEntries,
    fetchAllEntries,
    toggleEntry,
    setSkipReason,
    deleteHabit,
  } = useHabitStore();

  const [ordered, setOrdered] = useState<Habit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [skipTarget, setSkipTarget] = useState<{ habitId: string; date: string } | null>(null);
  const [skipInput, setSkipInput] = useState('');
  const [showPatterns, setShowPatterns] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const weekDates = useMemo(() => {
    const base = startOfWeek(new Date(selectedDate), { weekStartsOn: 1 });
    const start = addDays(base, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        date: format(d, 'yyyy-MM-dd'),
        day: DAY_KEYS[d.getDay() % 7]!,
        label: DAY_LABELS[d.getDay()] ?? '',
      };
    });
  }, [selectedDate, weekOffset]);

  const STORAGE_KEY = 'dayflow-habit-order';

  // Only show habits that existed during the viewed week
  // (habit createdAt date <= last day of viewed week)
  const weekEndDate = weekDates[6]?.date ?? format(new Date(), 'yyyy-MM-dd');
  const visibleHabits = ordered.filter((h) => {
    const created = h.createdAt.slice(0, 10); // YYYY-MM-DD
    return created <= weekEndDate;
  });

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);
  useEffect(() => {
    fetchAllEntries();
  }, [fetchAllEntries]);
  useEffect(() => {
    fetchEntries(weekDates.map((d) => d.date));
  }, [selectedDate, weekOffset]);

  useEffect(() => {
    if (habits.length === 0) {
      setOrdered([]);
      return;
    }
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (saved.length > 0) {
        const map = new Map(habits.map((h) => [h.id, h]));
        const reordered = [
          ...(saved.map((id) => map.get(id)).filter(Boolean) as Habit[]),
          ...habits.filter((h) => !saved.includes(h.id)),
        ];
        setOrdered(reordered);
      } else {
        setOrdered(habits);
      }
    } catch {
      setOrdered(habits);
    }
  }, [habits]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrdered((prev) => {
      const oldIndex = prev.findIndex((h) => h.id === active.id);
      const newIndex = prev.findIndex((h) => h.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((h) => h.id)));
      return next;
    });
  }

  function handleEdit(habit: Habit) {
    setEditingHabit(habit);
    setShowForm(true);
  }

  function handleSkip(habitId: string, date: string) {
    setSkipTarget({ habitId, date });
    setSkipInput('');
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingHabit(undefined);
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weeklyTargets = visibleHabits.reduce((total, habit) => {
    return total + weekDates.filter(({ date, day }) => habit.createdAt.slice(0, 10) <= date && habit.targetDays.includes(day)).length;
  }, 0);
  const weeklyDone = visibleHabits.reduce((total, habit) => {
    return total + weekDates.filter(({ date, day }) =>
      habit.createdAt.slice(0, 10) <= date &&
      habit.targetDays.includes(day) &&
      weekEntries.some((e) => e.habitId === habit.id && e.date === date && e.completed)
    ).length;
  }, 0);
  const weeklyPct = weeklyTargets > 0 ? Math.round((weeklyDone / weeklyTargets) * 100) : 0;
  const todayMeta = weekDates.find((d) => d.date === todayStr);
  const todayTargets = todayMeta
    ? visibleHabits.filter((h) => h.createdAt.slice(0, 10) <= todayStr && h.targetDays.includes(todayMeta.day))
    : [];
  const todayDone = todayTargets.filter((h) => weekEntries.some((e) => e.habitId === h.id && e.date === todayStr && e.completed)).length;
  const reminderCount = visibleHabits.filter((h) => Boolean(h.reminderTime)).length;
  const skippedCount = entries.filter((e) => !e.completed && e.skipReason).length;

  return (
    <div className="df-habits-workspace">
      <section className="df-habits-hero">
        <div>
          <span className="df-kicker">CONSISTENCY SYSTEM</span>
          <h2>Protect the habits that move your life forward.</h2>
          <p>Mark today, review the week, and use skip patterns as feedback instead of guilt.</p>
        </div>
        <button
          onClick={() => {
            setEditingHabit(undefined);
            setShowForm(true);
          }}
          className="df-btn df-btn-primary"
        >
          + New habit
        </button>
      </section>

      <section className="df-habit-kpis">
        <div className="df-habit-kpi is-primary">
          <span>Weekly consistency</span>
          <strong>{weeklyPct}%</strong>
          <div className="df-mini-progress"><i style={{ width: `${weeklyPct}%` }} /></div>
          <small>{weeklyDone} of {weeklyTargets || 0} target checks</small>
        </div>
        <div className="df-habit-kpi">
          <span>Today</span>
          <strong>{todayDone}/{todayTargets.length || 0}</strong>
          <small>{todayTargets.length === 0 ? 'No habits scheduled' : 'habits completed'}</small>
        </div>
        <div className="df-habit-kpi">
          <span>Active habits</span>
          <strong>{visibleHabits.length}</strong>
          <small>{reminderCount} with reminders</small>
        </div>
        <div className="df-habit-kpi">
          <span>Skip insights</span>
          <strong>{skippedCount}</strong>
          <small>logged reasons to review</small>
        </div>
      </section>

      <section className="df-habit-matrix-card">
        <div className="df-habit-matrix-head">
          <div>
            <span className="df-kicker">WEEK VIEW</span>
            <h3>{format(new Date(weekDates[0]!.date), 'MMM d')} – {format(new Date(weekDates[6]!.date), 'MMM d, yyyy')}</h3>
          </div>
          <div className="df-habit-week-nav">
            <button onClick={() => setWeekOffset((w) => w - 1)}>←</button>
            <button className={weekOffset === 0 ? 'is-current' : ''} onClick={() => setWeekOffset(0)}>
              {weekOffset === 0 ? 'Current week' : 'Back to current'}
            </button>
            <button onClick={() => setWeekOffset((w) => Math.min(0, w + 1))} disabled={weekOffset === 0}>→</button>
          </div>
        </div>

        <div className="df-habit-matrix-scroll">
          <div className="df-habit-columns min-w-[640px]">
            <div className="w-5 shrink-0" />
            <div className="w-44 shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--df-muted)' }}>Habit</div>
            <div className="flex gap-2 flex-1 justify-center">
              {weekDates.map(({ date, label }) => {
                const isToday = date === todayStr;
                return (
                  <div key={date} className={`df-habit-day-label ${isToday ? 'is-today' : ''}`}>
                    <span>{label.slice(0, 3)}</span>
                    <b>{format(new Date(date), 'd')}</b>
                  </div>
                );
              })}
            </div>
            <div className="w-14 text-center text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: 'var(--df-muted)' }}>Streak</div>
            <div className="w-14 shrink-0" />
          </div>

          <div className="min-w-[640px]">
            {visibleHabits.length === 0 ? (
              <div className="df-empty-state" style={{ margin: 16 }}>
                <span style={{ fontSize: 28 }}>✓</span>
                <strong>{weekOffset < 0 ? 'No habits were tracked this week.' : 'Start your consistency system.'}</strong>
                <p>{weekOffset < 0 ? 'Move back to the current week or choose another week.' : 'Create one habit and give it a realistic target schedule.'}</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleHabits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                  {visibleHabits.map((habit) => (
                    <SortableHabitRow
                      key={habit.id}
                      habit={habit}
                      entries={weekEntries}
                      allEntries={entries}
                      dates={weekDates}
                      onToggle={toggleEntry}
                      onSkip={handleSkip}
                      onDelete={deleteHabit}
                      onEdit={handleEdit}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {skippedCount > 0 && (
          <div className="df-habit-patterns">
            <button className="df-habit-pattern-toggle" onClick={() => setShowPatterns((p) => !p)}>
              <span><b>Skip patterns</b><small>{skippedCount} logged reasons across your habits</small></span>
              <span>{showPatterns ? '−' : '+'}</span>
            </button>
            {showPatterns && (() => {
              const allSkipped = entries.filter((e) => !e.completed && e.skipReason);
              const patternsByHabit = habits
                .map((h) => {
                  const reasons = allSkipped.filter((e) => e.habitId === h.id).map((e) => e.skipReason!);
                  if (reasons.length === 0) return null;
                  const counts: Record<string, number> = {};
                  reasons.forEach((r) => { counts[r] = (counts[r] ?? 0) + 1; });
                  return { habit: h, counts };
                })
                .filter(Boolean) as { habit: Habit; counts: Record<string, number> }[];
              return (
                <div className="df-habit-pattern-grid">
                  {patternsByHabit.map(({ habit, counts }) => (
                    <div key={habit.id} className="df-habit-pattern-card">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: habit.color }} />
                        <strong>{habit.title}</strong>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(counts).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                          <span key={reason} className="df-chip is-amber">{reason} · {count}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {showForm && (
        <HabitForm onClose={handleFormClose} {...(editingHabit ? { editing: editingHabit } : {})} />
      )}

      {skipTarget && (
        <div className="df-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSkipTarget(null)}>
          <div className="df-modal-panel w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-head">
              <div><span className="df-kicker">HABIT FEEDBACK</span><h3>Why did you skip?</h3></div>
              <button onClick={() => setSkipTarget(null)}>×</button>
            </div>
            <div className="df-modal-body">
              <p className="df-section-copy">Logging the reason helps you find patterns without treating one missed day as failure.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Too tired', 'No time', 'Forgot', 'Was sick', 'Out of town', 'Other'].map((preset) => (
                  <button key={preset} onClick={() => setSkipInput(preset)} className={`df-chip ${skipInput === preset ? 'is-amber' : ''}`}>{preset}</button>
                ))}
              </div>
              <input
                type="text"
                value={skipInput}
                onChange={(e) => setSkipInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && skipInput.trim()) {
                    await setSkipReason(skipTarget.habitId, skipTarget.date, skipInput.trim());
                    setSkipTarget(null);
                  }
                }}
                placeholder="Or type a custom reason…"
                autoFocus
                style={{ width: '100%', marginTop: 14 }}
              />
            </div>
            <div className="df-modal-actions">
              <button className="df-btn df-btn-secondary" onClick={() => setSkipTarget(null)}>Cancel</button>
              <button
                className="df-btn df-btn-primary"
                disabled={!skipInput.trim()}
                onClick={async () => {
                  if (!skipInput.trim()) return;
                  await setSkipReason(skipTarget.habitId, skipTarget.date, skipInput.trim());
                  setSkipTarget(null);
                }}
              >
                Save reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
