import { useCallback, useMemo } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { DndContext, DragEndEvent, pointerWithin, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import WeekView from '@/components/week/WeekView';
import type { DragData } from '@/types';

function DragPreview({ data }: { data: DragData }) {
    const task = data.type === 'library-task' ? data.task : data.scheduledTask?.task;
    if (!task) return null;
    return (
        <div
            className="rounded border-l-4 px-3 py-2 text-xs shadow-xl bg-white dark:bg-gray-700 w-40 opacity-95"
            style={{ borderLeftColor: task.color, backgroundColor: `${task.color}18` }}
        >
            <p className="font-semibold truncate dark:text-white">{task.title}</p>
            <p className="text-brand-muted">{task.durationMins}m</p>
        </div>
    );
}

export default function WeekPage() {
    const { weekStart, setDate } = useUIStore();
    const { scheduledTasks, addTask, updateSlot, fetchByWeek } = usePlannerStore();
    const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

    const weekDates = useMemo(() => {
        const start = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => ({
            date: format(addDays(start, i), 'yyyy-MM-dd'),
            label: format(addDays(start, i), 'EEE d'),
        }));
    }, [weekStart]);

    const goWeek = useCallback((dir: 1 | -1) => {
        const fn = dir === 1 ? addWeeks : subWeeks;
        const next = format(fn(new Date(weekStart), 1), 'yyyy-MM-dd');
        useUIStore.getState().setDate(next);
        useUIStore.setState({ weekStart: next });
    }, [weekStart]);

    const onDragStart = useCallback((e: DragStartEvent) => {
        setActiveDragData(e.active.data.current as DragData);
    }, []);

    const onDragEnd = useCallback(async (event: DragEndEvent) => {
        setActiveDragData(null);
        const { active, over } = event;
        if (!over) return;
        const data = active.data.current as DragData;
        const [dateStr, slotStr] = over.id.toString().replace('week-slot-', '').split('::');
        const slot = parseInt(slotStr ?? '', 10);
        if (!dateStr || isNaN(slot)) return;

        if (data.type === 'library-task' && data.task) {
            await addTask(data.task.id, dateStr, slot);
        } else if (data.type === 'scheduled-task' && data.scheduledTask) {
            await updateSlot(data.scheduledTask.id, slot, dateStr);
        }
    }, [addTask, updateSlot]);

    return (
        <DndContext collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="max-w-screen-xl mx-auto">
                {/* Nav */}
                <div className="flex items-center justify-between mb-3">
                    <button onClick={() => goWeek(-1)} className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600">← Prev</button>
                    <span className="font-semibold text-sm dark:text-white">
                        Week of {format(new Date(weekStart), 'MMM d, yyyy')}
                    </span>
                    <button onClick={() => goWeek(1)} className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600">Next →</button>
                </div>
                <WeekView
                    weekDates={weekDates}
                    scheduledTasks={scheduledTasks}
                    fetchByWeek={fetchByWeek}
                />
            </div>
            <DragOverlay dropAnimation={null}>
                {activeDragData && <DragPreview data={activeDragData} />}
            </DragOverlay>
        </DndContext>
    );
}