import { useEffect, useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
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
import { usePriorityStore } from '@/store/priorityStore';
import type { Priority, PriorityItem } from '@/types';

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  medium:
    'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  low: 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

// Returns label + color class for a due date
function dueDateLabel(dateStr: string): { label: string; className: string } {
  const days = differenceInCalendarDays(new Date(dateStr + 'T12:00:00'), new Date());
  if (days < 0)
    return { label: 'Overdue', className: 'text-red-500 dark:text-red-400 font-semibold' };
  if (days === 0)
    return { label: 'Due today', className: 'text-red-500 dark:text-red-400 font-semibold' };
  if (days === 1)
    return { label: 'Due tomorrow', className: 'text-amber-500 dark:text-amber-400 font-semibold' };
  if (days <= 4)
    return {
      label: `Due ${format(new Date(dateStr + 'T12:00:00'), 'MMM d')}`,
      className: 'text-amber-500 dark:text-amber-400',
    };
  return {
    label: `Due ${format(new Date(dateStr + 'T12:00:00'), 'MMM d')}`,
    className: 'text-brand-muted',
  };
}

// Extract course code from Canvas-style titles: "W01 Assignment: Foo [WDD430]" → { title: "W01 Assignment: Foo", course: "WDD430" }
function parseTitle(raw: string): { title: string; course?: string | undefined } {
  const match = raw.match(/^(.*?)\s*\[([A-Z]{2,4}\d{3}[A-Za-z0-9]*)\]\s*$/);
  if (match && match[2]) return { title: match[1]!.trim(), course: match[2] };
  return { title: raw };
}

function SortablePriorityRow({
  item,
  onToggle,
  onDelete,
}: {
  item: PriorityItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const due = item.dueDate ? dueDateLabel(item.dueDate) : null;
  const { title, course } = parseTitle(item.title);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border
        bg-gray-50 dark:bg-gray-700/60 dark:border-gray-600/50
        ${item.done ? 'opacity-40' : ''}
        ${isDragging ? 'opacity-40 z-50' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 text-xs leading-none"
      >
        ⠿
      </div>

      {/* Priority badge */}
      <span
        className={`text-[9px] font-bold px-1 py-px rounded border shrink-0 ${PRIORITY_COLORS[item.priority]}`}
      >
        {PRIORITY_BADGE[item.priority]}
      </span>

      {/* Title + course badge */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span
          className={`text-xs dark:text-white truncate ${item.done ? 'line-through text-brand-muted' : ''}`}
        >
          {title}
        </span>
        {course && (
          <span className="text-[9px] font-semibold px-1 py-px rounded shrink-0 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300">
            {course}
          </span>
        )}
      </div>

      {/* Due date — inline, compact */}
      {due && !item.done && (
        <span className={`text-[10px] shrink-0 ${due.className}`}>{due.label}</span>
      )}

      {/* Checkbox */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggle(item.id)}
        className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center
          ${item.done ? 'bg-brand-green border-brand-green' : 'border-gray-300 dark:border-gray-500'}`}
      >
        {item.done && (
          <span className="text-white leading-none" style={{ fontSize: 8 }}>
            ✓
          </span>
        )}
      </button>

      {/* Delete */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(item.id)}
        className="text-gray-300 hover:text-red-400 text-xs leading-none shrink-0"
      >
        ×
      </button>
    </div>
  );
}

export default function PriorityPanel() {
  const { items, fetchAll, addItem, toggleDone, deleteItem } = usePriorityStore();
  const [ordered, setOrdered] = useState<PriorityItem[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const STORAGE_KEY = 'dayflow-priority-order';

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (items.length === 0) {
      setOrdered([]);
      return;
    }
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (saved.length > 0) {
        const map = new Map(items.map((i) => [i.id, i]));
        const reordered = [
          ...(saved.map((id) => map.get(id)).filter(Boolean) as PriorityItem[]),
          ...items.filter((i) => !saved.includes(i.id)),
        ];
        setOrdered(reordered);
      } else {
        setOrdered(items);
      }
    } catch {
      setOrdered(items);
    }
  }, [items]);

  const save = async () => {
    if (!title.trim()) return;
    await addItem(title.trim(), priority, dueDate || undefined);
    setTitle('');
    setDueDate('');
    setAdding(false);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrdered((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((i) => i.id)));
      return next;
    });
  }

  const [showAll, setShowAll] = useState(false);

  // "This week" = today through end of Sunday (or next 7 days for items without a date)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const isThisWeek = (item: PriorityItem) => {
    if (!item.dueDate) return true; // no due date → always show (manually added)
    const due = new Date(item.dueDate + 'T12:00:00');
    return due <= weekEnd;
  };

  const allPending = ordered.filter((i) => !i.done);
  const allDone = ordered.filter((i) => i.done);

  const pending = showAll ? allPending : allPending.filter(isThisWeek);
  const done = showAll ? allDone : allDone.filter(isThisWeek);

  const hiddenCount = allPending.filter((i) => !isThisWeek(i)).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-brand-accent2 text-white px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">⭐ Priority / This Week</span>
          {pending.length > 0 && (
            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{pending.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
            title={showAll ? 'Show this week only' : 'Show all items'}
          >
            {showAll ? 'This week' : 'All'}
          </button>
          <button
            onClick={() => setAdding(!adding)}
            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="p-3 border-b dark:border-gray-700 flex flex-col gap-2">
          <input
            autoFocus
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="Task title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <div className="flex gap-1">
            {(['high', 'medium', 'low'] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1 rounded text-xs font-semibold capitalize border
                  ${priority === p ? PRIORITY_COLORS[p] : 'dark:text-white dark:border-gray-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-brand-muted shrink-0">Due date</label>
            <input
              type="date"
              className="flex-1 border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-white dark:border-gray-600"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setDueDate('');
              }}
              className="flex-1 border rounded py-1 text-xs dark:text-white dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="flex-1 bg-brand-accent2 text-white rounded py-1 text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Sortable list */}
      <div className="overflow-y-auto flex-1 px-2 py-1.5" style={{ maxHeight: '460px' }}>
        {ordered.length === 0 && (
          <p className="text-xs text-brand-muted text-center mt-4">No items yet.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1">
              {/* Pending items first */}
              {pending.map((item) => (
                <SortablePriorityRow
                  key={item.id}
                  item={item}
                  onToggle={toggleDone}
                  onDelete={deleteItem}
                />
              ))}
              {/* Divider between pending and done */}
              {pending.length > 0 && done.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 border-t dark:border-gray-700" />
                  <span className="text-[10px] text-brand-muted">completed</span>
                  <div className="flex-1 border-t dark:border-gray-700" />
                </div>
              )}
              {/* Done items */}
              {done.map((item) => (
                <SortablePriorityRow
                  key={item.id}
                  item={item}
                  onToggle={toggleDone}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Show hidden count when in week mode */}
        {!showAll && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-xs text-brand-muted hover:text-brand-accent py-2 border-t dark:border-gray-700 transition-colors"
          >
            +{hiddenCount} more item{hiddenCount !== 1 ? 's' : ''} due later → Show all
          </button>
        )}
      </div>
    </div>
  );
}
