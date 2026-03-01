import { useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { usePlannerStore } from '@/store/plannerStore';

interface Props {
    date: string;
    onClose: () => void;
}

export default function MiniTaskPicker({ date, onClose }: Props) {
    const { tasks } = useTaskStore();
    const { addTask } = usePlannerStore();
    const [slot, setSlot] = useState(16); // default 8:00am = slot 16

    const pick = async (taskId: string) => {
        await addTask(taskId, date, slot);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 w-full max-w-xs">
                <h3 className="font-bold text-sm mb-1 dark:text-white">Add task to {date}</h3>

                <label className="text-xs text-brand-muted">Time slot</label>
                <select
                    className="w-full border rounded-lg px-3 py-1.5 mb-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={slot}
                    onChange={(e) => setSlot(Number(e.target.value))}
                >
                    {Array.from({ length: 48 }, (_, i) => {
                        const h = String(Math.floor(i / 2)).padStart(2, '0');
                        const m = i % 2 === 0 ? '00' : '30';
                        return <option key={i} value={i}>{h}:{m}</option>;
                    })}
                </select>

                <p className="text-xs text-brand-muted mb-2">Pick a task from your library</p>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-3">
                    {tasks.length === 0 && (
                        <p className="text-xs text-brand-muted text-center py-2">No tasks in library yet.</p>
                    )}
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            onClick={() => pick(task.id)}
                            className="flex items-center gap-2 p-2 rounded-lg border text-left hover:bg-gray-50
                dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold dark:text-white truncate">{task.title}</p>
                                <p className="text-xs text-brand-muted capitalize">{task.category} · {task.durationMins}m</p>
                            </div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}