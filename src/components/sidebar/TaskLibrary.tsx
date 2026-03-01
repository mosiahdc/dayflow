import { useEffect, useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import TaskForm from './TaskForm';
import type { Task } from '@/types';
import { useDraggable } from '@dnd-kit/core';

function DraggableTaskCard({ task, onEdit }: { task: Task; onEdit: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `library-${task.id}`,
        data: { type: 'library-task', task },
    });

    const displayDuration = task.durationMins >= 60
        ? `${Math.floor(task.durationMins / 60)}h${task.durationMins % 60 > 0 ? ` ${task.durationMins % 60}m` : ''}`
        : `${task.durationMins}m`;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`bg-white dark:bg-gray-700 rounded-lg border-l-4 p-3 shadow-sm
        cursor-grab active:cursor-grabbing select-none
        ${isDragging ? 'opacity-40' : 'hover:shadow-md transition-shadow'}`}
            style={{ borderLeftColor: task.color }}
        >
            <div className="flex justify-between items-start gap-1">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-dark dark:text-white truncate">
                        {task.title}
                    </p>
                    <p className="text-xs text-brand-muted mt-0.5 capitalize">
                        {task.category} · {displayDuration}
                    </p>
                </div>
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onEdit}
                    className="text-gray-300 hover:text-brand-accent text-xs shrink-0 ml-1"
                >
                    ✏️
                </button>
            </div>
        </div>
    );
}

export default function TaskLibrary() {
    const { tasks, fetchAll } = useTaskStore();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Task | undefined>();
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('all');

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Build dynamic category list from actual tasks
    const categories = ['all', ...Array.from(new Set(tasks.map((t) => t.category)))];

    const filtered = tasks.filter((t) => {
        const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
        const matchCategory = activeFilter === 'all' || t.category === activeFilter;
        return matchSearch && matchCategory;
    });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow flex flex-col h-full">
            {/* Header */}
            <div className="bg-brand-accent2 text-white px-4 py-2 rounded-t-xl flex justify-between items-center shrink-0">
                <span className="font-semibold text-sm">Task Library</span>
                <button
                    onClick={() => { setEditing(undefined); setShowForm(true); }}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                >
                    + New
                </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b dark:border-gray-700 shrink-0">
                <input
                    className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    placeholder="🔍 Search tasks…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Category filter — dynamic + scrollable */}
            <div className="flex gap-1 px-3 py-2 border-b dark:border-gray-700 overflow-x-auto shrink-0 scrollbar-none">
                {categories.map((c) => (
                    <button
                        key={c}
                        onClick={() => setActiveFilter(c)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap
              transition-all border-2
              ${activeFilter === c
                                ? 'bg-brand-accent text-white border-brand-accent'
                                : 'border-gray-200 dark:border-gray-600 dark:text-white hover:border-brand-accent'}`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {filtered.length === 0 && (
                    <p className="text-xs text-brand-muted text-center mt-4">
                        {tasks.length === 0 ? 'No tasks yet. Create one!' : 'No matches.'}
                    </p>
                )}
                {filtered.map((task) => (
                    <DraggableTaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => { setEditing(task); setShowForm(true); }}
                    />
                ))}
            </div>

            {showForm && (
                <TaskForm
                    editing={editing}
                    onClose={() => { setShowForm(false); setEditing(undefined); }}
                />
            )}
        </div>
    );
}