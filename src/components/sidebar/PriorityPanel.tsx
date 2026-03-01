import { useEffect, useState } from 'react';
import { usePriorityStore } from '@/store/priorityStore';
import type { Priority } from '@/types';

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

export default function PriorityPanel() {
    const { items, fetchAll, addItem, toggleDone, deleteItem } = usePriorityStore();
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<Priority>('medium');
    const [adding, setAdding] = useState(false);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const save = async () => {
        if (!title.trim()) return;
        await addItem(title.trim(), priority);
        setTitle('');
        setAdding(false);
    };

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

            {/* List */}
            <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1.5" style={{ maxHeight: '460px' }}>
                {items.length === 0 && (
                    <p className="text-xs text-brand-muted text-center mt-4">No items yet.</p>
                )}
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border
              ${item.done ? 'opacity-50' : ''}
              bg-gray-50 dark:bg-gray-700 dark:border-gray-600`}
                    >
                        {/* Priority badge */}
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLORS[item.priority]}`}>
                            {PRIORITY_BADGE[item.priority]}
                        </span>

                        {/* Title */}
                        <span className={`flex-1 text-sm dark:text-white truncate
              ${item.done ? 'line-through text-brand-muted' : ''}`}>
                            {item.title}
                        </span>

                        {/* Actions */}
                        <button
                            onClick={() => toggleDone(item.id)}
                            className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center
                ${item.done ? 'bg-brand-green border-brand-green' : 'border-gray-300'}`}
                        >
                            {item.done && <span className="text-white text-xs leading-none">✓</span>}
                        </button>
                        <button
                            onClick={() => deleteItem(item.id)}
                            className="text-gray-300 hover:text-red-400 text-sm leading-none shrink-0"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}