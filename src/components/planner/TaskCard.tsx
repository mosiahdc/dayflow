import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTimer } from '@/hooks/useTimer';
import type { ScheduledTask } from '@/types';

interface Props {
    scheduledTask: ScheduledTask;
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
    index: number;
    total: number;
}

const TaskCard = memo(function TaskCard({ scheduledTask: st, onRemove, onToggle, index, total }: Props) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `scheduled-${st.id}`,
        data: { type: 'scheduled-task', scheduledTask: st },
    });

    const timer = useTimer(st.task.durationMins, 'countdown', () => {
        if (!st.done) onToggle(st.id);
    });
    const isActive = timer.state !== 'idle';
    const spanRows = st.task.durationMins / 30;
    const isCompact = spanRows === 1; // 30-min card
    const widthPct = `${100 / total}%`;

    return (
        <div
            ref={setNodeRef}
            className={`rounded border-l-4 text-xs shadow-sm absolute z-10 overflow-hidden
        flex flex-col cursor-grab active:cursor-grabbing
        bg-white dark:bg-gray-700
        ${st.done ? 'opacity-40' : ''}
        ${isDragging ? 'opacity-30 z-50' : ''}`}
            style={{
                borderLeftColor: st.task.color,
                height: `${spanRows * 40 - 2}px`,
                width: `calc(${widthPct} - 4px)`,
                left: `calc(${index} * ${widthPct} + 2px)`,
                top: '1px',
            }}
            {...listeners}
            {...attributes}
        >
            {/* Progress bar — fills left to right as time passes */}
            {isActive && (
                <div
                    className="absolute inset-0 transition-all duration-1000 pointer-events-none"
                    style={{
                        backgroundColor: `${st.task.color}30`,
                        width: `${timer.progress * 100}%`,
                    }}
                />
            )}

            <div className="relative flex flex-col h-full px-2 py-0.5">

                {isCompact ? (
                    /* ── COMPACT LAYOUT (30min) — single row ── */
                    <div className="flex items-center gap-1 h-full">
                        {/* Timer display — left side, only when active */}
                        {isActive && (
                            <span className="font-mono font-bold text-brand-dark dark:text-white shrink-0 text-xs">
                                {timer.display}
                            </span>
                        )}

                        {/* Task name — always visible */}
                        <span className={`font-semibold text-brand-dark dark:text-white truncate flex-1
      ${st.done ? 'line-through' : ''}`}>
                            {st.task.title}
                        </span>

                        {/* Timer control */}
                        {timer.state === 'idle' && (
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.start} title="Start">⏱</button>
                        )}
                        {timer.state === 'running' && (
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.pause} className="text-brand-amber" title="Pause">⏸</button>
                        )}
                        {timer.state === 'paused' && (
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.resume} className="text-brand-accent" title="Resume">▶</button>
                        )}
                        {timer.state === 'done' && (
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.start} className="text-brand-green" title="Restart">↺</button>
                        )}
                        {isActive && (
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.stop} className="text-red-400" title="Stop">⏹</button>
                        )}

                        {/* Done checkbox */}
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onToggle(st.id)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
        ${st.done ? 'bg-brand-green border-brand-green' : 'border-gray-300'}`}
                        >
                            {st.done && <span className="text-white leading-none" style={{ fontSize: 8 }}>✓</span>}
                        </button>

                        {/* Remove */}
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onRemove(st.id)}
                            className="text-gray-300 hover:text-red-400 leading-none"
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    /* ── TALL LAYOUT (60min+) — multi row ── */
                    <>
                        {/* Top row */}
                        <div className="flex justify-between items-start gap-1">
                            <span className={`font-semibold text-brand-dark dark:text-white truncate leading-tight
                ${st.done ? 'line-through' : ''}`}>
                                {st.task.title}
                            </span>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onRemove(st.id)}
                                className="text-gray-300 hover:text-red-400 shrink-0 leading-none"
                            >
                                ×
                            </button>
                        </div>

                        {/* Timer countdown */}
                        {isActive && (
                            <span className="font-mono font-bold text-brand-dark dark:text-white text-sm leading-none mt-0.5">
                                {timer.display}
                            </span>
                        )}

                        {/* Bottom row */}
                        <div className="flex justify-between items-center mt-auto">
                            <div className="flex items-center gap-1">
                                {timer.state === 'idle' && (
                                    <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.start} className="text-brand-muted hover:text-brand-accent" title="Start">⏱</button>
                                )}
                                {timer.state === 'running' && (
                                    <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.pause} className="text-brand-amber" title="Pause">⏸</button>
                                )}
                                {timer.state === 'paused' && (
                                    <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.resume} className="text-brand-accent" title="Resume">▶</button>
                                )}
                                {timer.state === 'done' && (
                                    <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.start} className="text-brand-green" title="Restart">↺</button>
                                )}
                                {isActive && (
                                    <button onPointerDown={(e) => e.stopPropagation()} onClick={timer.stop} className="text-red-400" title="Stop">⏹</button>
                                )}
                                {!isActive && (
                                    <span className="text-brand-muted">{st.task.durationMins}m</span>
                                )}
                            </div>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onToggle(st.id)}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                  ${st.done ? 'bg-brand-green border-brand-green' : 'border-gray-300'}`}
                            >
                                {st.done && <span className="text-white text-xs leading-none">✓</span>}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

export default TaskCard;