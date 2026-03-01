import { memo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { usePlannerStore } from '@/store/plannerStore';
import TaskCard from './TaskCard';
import TaskForm from '@/components/sidebar/TaskForm';
import type { ScheduledTask } from '@/types';

interface Props {
    slot: { index: number; label: string };
    date: string;
    scheduledTasks: ScheduledTask[];
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
}

const TimeSlot = memo(function TimeSlot({ slot, date, scheduledTasks, onRemove, onToggle }: Props) {
    const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot.index}` });
    const { addTask } = usePlannerStore();
    const [showForm, setShowForm] = useState(false);

    const startingTasks = scheduledTasks.filter((st) => st.startSlot === slot.index);

    const handleSave = async (taskId: string) => {
        await addTask(taskId, date, slot.index);
    };

    return (
        <div
            ref={setNodeRef}
            className={`flex border-b border-brand-border min-h-[40px] relative transition-colors group
        ${isOver ? 'bg-brand-accent/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
        >
            <span className="w-14 text-xs text-brand-muted px-2 py-1 shrink-0 select-none">
                {slot.label}
            </span>
            <div className="flex-1 relative">
                {startingTasks.map((st, i) => (
                    <TaskCard
                        key={st.id}
                        scheduledTask={st}
                        onRemove={onRemove}
                        onToggle={onToggle}
                        index={i}
                        total={startingTasks.length}
                    />
                ))}

                {/* Quick add button */}
                {!showForm && startingTasks.length === 0 && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300
              hover:text-brand-accent opacity-0 group-hover:opacity-100
              transition-opacity text-lg leading-none"
                        title="Add task to this slot"
                    >
                        +
                    </button>
                )}
            </div>

            {/* Reuse TaskForm modal */}
            {showForm && (
                <TaskForm
                    onClose={() => setShowForm(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
});

export default TimeSlot;