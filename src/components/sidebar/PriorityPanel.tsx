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

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; border: string }> = {
  high:   { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
  medium: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  low:    { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
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
      className={`flex items-center gap-2 p-2 rounded-lg
        ${item.done ? 'opacity-50' : ''}
        ${isDragging ? 'opacity-40 z-50' : ''}`}
      css={{ border: '1px solid var(--df-border)', background: 'var(--df-surface2)' } as React.CSSProperties}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing shrink-0 text-base leading-none"
        style={{ color: 'var(--df-border2)' }}
        title="Drag to reorder"
      >
        ⠿
      </div>

      {/* Priority badge */}
      <span
        className="text-xs font-bold px-1.5 py-0.5 rounded border shrink-0"
        style={{
          background: PRIORITY_COLORS[item.priority].bg,
          color: PRIORITY_COLORS[item.priority].text,
          borderColor: PRIORITY_COLORS[item.priority].border,
        }}
      >
        {PRIORITY_BADGE[item.priority]}
      </span>

      {/* Title */}
      <span
        className={`flex-1 text-sm truncate ${item.done ? 'line-through' : ''}`}
        style={{ color: item.done ? 'var(--df-muted)' : 'var(--df-text)' }}
      >
        {item.title}
      </span>

      {/* Checkbox */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggle(item.id)}
        className="w-4 h-4 rounded border shrink-0 flex items-center justify-center"
        style={{
          background: item.done ? 'var(--df-green)' : 'transparent',
          borderColor: item.done ? 'var(--df-green)' : 'var(--df-border2)',
        }}
      >
        {item.done && <span className="text-white text-xs leading-none">✓</span>}
      </button>

      {/* Delete */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(item.id)}
        className="text-sm leading-none shrink-0 transition-colors"
        style={{ color: 'var(--df-border2)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#f87171')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--df-border2)')}
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
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex justify-between items-center"
        style={{ background: 'rgba(124,58,237,0.15)', borderBottom: '1px solid var(--df-border)' }}
      >
        <span className="font-semibold text-sm text-white">⭐ Priority</span>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs px-2 py-1 rounded font-medium text-white transition-colors"
          style={{ background: 'var(--df-purple)' }}
        >
          + Add
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--df-border)' }}>
          <input
            autoFocus
            className="w-full rounded-lg px-3 py-1.5 text-sm text-white outline-none"
            style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
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
                className="flex-1 py-1 rounded text-xs font-semibold capitalize border transition-all"
                style={
                  priority === p
                    ? { background: PRIORITY_COLORS[p].bg, color: PRIORITY_COLORS[p].text, borderColor: PRIORITY_COLORS[p].border }
                    : { background: 'transparent', color: 'var(--df-muted)', borderColor: 'var(--df-border)' }
                }
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="flex-1 rounded py-1 text-xs transition-colors"
              style={{ border: '1px solid var(--df-border)', color: 'var(--df-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="flex-1 text-white rounded py-1 text-xs font-semibold"
              style={{ background: 'var(--df-purple)' }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Sortable list */}
      <div className="overflow-y-auto flex-1 p-2" style={{ maxHeight: '460px' }}>
        {ordered.length === 0 && (
          <p className="text-xs text-center mt-4" style={{ color: 'var(--df-muted)' }}>No items yet.</p>
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
