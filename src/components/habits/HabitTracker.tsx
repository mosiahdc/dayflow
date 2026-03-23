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
  onDelete,
  onEdit,
}: {
  habit: Habit;
  entries: HabitEntry[];
  allEntries: HabitEntry[];
  dates: { date: string; day: DayOfWeek; label: string }[];
  onToggle: (habitId: string, date: string) => void;
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
      className={`min-w-[560px] transition-colors ${isDragging ? 'opacity-40 z-50' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing shrink-0 text-base leading-none" style={{ color: 'var(--df-border2)' }}
        >
          ⠿
        </div>

        {/* Color stripe + name */}
        <div className="flex items-center gap-2 w-36 shrink-0">
          <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{habit.title}</p>
            <p className="text-xs capitalize" style={{ color: 'var(--df-muted)' }}>{habit.category}</p>
          </div>
        </div>

        {/* Day checkboxes */}
        <div className="flex gap-2 flex-1 justify-center">
          {dates.map(({ date, day }) => {
            const entry = entries.find((e) => e.habitId === habit.id && e.date === date);
            const completed = entry?.completed ?? false;
            const isTarget = habit.targetDays.includes(day);
            return (
              <button
                key={date}
                onClick={() => isTarget && onToggle(habit.id, date)}
                className="w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  opacity: !isTarget ? 0.2 : 1,
                  cursor: !isTarget ? 'default' : 'pointer',
                  borderColor: completed ? 'var(--df-green)' : 'var(--df-border2)',
                  background: completed ? 'var(--df-green)' : 'transparent',
                  color: completed ? '#fff' : 'transparent',
                }}
              >
                {completed && '✓'}
              </button>
            );
          })}
        </div>

        {/* Streak */}
        <div className="w-12 text-center shrink-0">
          {streak > 0 ? (
            <span className="text-xs font-bold" style={{ color: 'var(--df-amber)' }}>{streak} 🔥</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--df-muted)' }}>—</span>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={() => onEdit(habit)}
          className="text-sm shrink-0 transition-colors" style={{ color: 'var(--df-muted)' }}
          title="Edit habit"
        >
          ✏️
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(habit.id)}
          className="text-sm shrink-0 transition-colors" style={{ color: 'var(--df-border2)' }}
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
          <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>on target days</span>
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
    deleteHabit,
  } = useHabitStore();

  const [ordered, setOrdered] = useState<Habit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.

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
  const visibleHabits = ordered.filter(h => {
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

  function handleFormClose() {
    setShowForm(false);
    setEditingHabit(undefined);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}>
      {/* Header */}
      <div className="px-3 py-2.5 flex justify-between items-center" style={{ background: 'var(--df-green)' }}>
        <span className="font-semibold text-sm">✅ Habit Tracker</span>
        <button
          onClick={() => {
            setEditingHabit(undefined);
            setShowForm(true);
          }}
          className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white"
        >
          + Add Habit
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--df-border)', background: 'var(--df-surface2)' }}>
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}
        >
          ← Prev
        </button>

        <div className="text-center">
          <div className="text-xs font-medium" style={{ color: 'var(--df-text)' }}>
            {format(new Date(weekDates[0]!.date), 'MMM d')} – {format(new Date(weekDates[6]!.date), 'MMM d, yyyy')}
          </div>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--df-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Back to current week
            </button>
          )}
          {weekOffset === 0 && (
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--df-muted)' }}>Current week</div>
          )}
        </div>

        <button
          onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: weekOffset < 0 ? 'var(--df-border)' : 'transparent',
            color: weekOffset < 0 ? 'var(--df-muted)' : 'transparent',
            border: 'none',
            cursor: weekOffset < 0 ? 'pointer' : 'default',
          }}
        >
          Next →
        </button>
      </div>

      {/* Column headers + rows — horizontally scrollable on mobile */}
      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className="flex items-center gap-2 px-3 py-1.5 min-w-[560px]" style={{ borderBottom: '1px solid var(--df-border)', background: 'var(--df-surface2)' }}>
          <div className="w-5 shrink-0" />
          <div className="w-36 shrink-0" />
          <div className="flex gap-2 flex-1 justify-center">
            {weekDates.map(({ date, label }) => {
              const isToday = date === format(new Date(), 'yyyy-MM-dd');
              const isPast = date < format(new Date(), 'yyyy-MM-dd');
              return (
                <div
                  key={date}
                  className={`w-7 text-center text-xs font-semibold
                    ${isToday ? 'text-blue-400' : isPast && weekOffset < 0 ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  {label}
                </div>
              );
            })}
          </div>
          <div className="w-12 text-center text-xs font-semibold shrink-0" style={{ color: 'var(--df-muted)' }}>
            Streak
          </div>
          <div className="w-5 shrink-0" />
          <div className="w-5 shrink-0" />
        </div>

        {/* Rows */}
        <div className="min-w-[560px]">
          {visibleHabits.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--df-muted)' }}>
              {weekOffset < 0 ? 'No habits were tracked this week.' : 'No habits yet. Add one!'}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleHabits.map((h) => h.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleHabits.map((habit) => (
                  <SortableHabitRow
                    key={habit.id}
                    habit={habit}
                    entries={weekEntries}
                    allEntries={entries}
                    dates={weekDates}
                    onToggle={toggleEntry}
                    onDelete={deleteHabit}
                    onEdit={handleEdit}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Form — handles both create and edit */}
      {showForm && (
        <HabitForm onClose={handleFormClose} {...(editingHabit ? { editing: editingHabit } : {})} />
      )}
    </div>
  );
}
