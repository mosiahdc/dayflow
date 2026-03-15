import { useEffect, useState } from 'react';
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
  high: 'bg-red-100 text-red-600 border-red-200',
  medium: 'bg-amber-100 text-amber-600 border-amber-200',
  low: 'bg-green-100 text-green-600 border-green-200',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border
        bg-gray-50 dark:bg-gray-700 dark:border-gray-600
        ${item.done ? 'opacity-50' : ''}
        ${isDragging ? 'opacity-40 z-50' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 text-base leading-none"
        title="Drag to reorder"
      >
        ⠿
      </div>

      {/* Priority badge */}
      <span
        className={`text-xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLORS[item.priority]}`}
      >
        {PRIORITY_BADGE[item.priority]}
      </span>

      {/* Title */}
      <span
        className={`flex-1 text-sm dark:text-white truncate
        ${item.done ? 'line-through text-brand-muted' : ''}`}
      >
        {item.title}
      </span>

      {/* Checkbox */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggle(item.id)}
        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center
          ${item.done ? 'bg-brand-green border-brand-green' : 'border-gray-300'}`}
      >
        {item.done && <span className="text-white text-xs leading-none">✓</span>}
      </button>

      {/* Delete */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(item.id)}
        className="text-gray-300 hover:text-red-400 text-sm leading-none shrink-0"
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
    // Always sync — handles deletions, additions, and reorders
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
    await addItem(title.trim(), priority);
    setTitle('');
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-brand-accent2 text-white px-4 py-2 flex justify-between items-center">
        <span className="font-semibold text-sm">⭐ Priority / This Week</span>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
        >
          + Add
        </button>
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
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
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
      <div className="overflow-y-auto flex-1 p-2" style={{ maxHeight: '460px' }}>
        {ordered.length === 0 && (
          <p className="text-xs text-brand-muted text-center mt-4">No items yet.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {ordered.map((item) => (
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
      </div>
    </div>
  );
}
