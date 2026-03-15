import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTimer } from '@/hooks/useTimer';
import type { ScheduledTask } from '@/types';

interface Props {
  scheduledTask: ScheduledTask;
  col: number;
  totalCols: number;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

const TaskCard = memo(function TaskCard({
  scheduledTask: st,
  col,
  totalCols,
  onRemove,
  onToggle,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scheduled-${st.id}`,
    data: { type: 'scheduled-task', scheduledTask: st },
  });

  const timer = useTimer(st.task.durationMins, 'countdown', () => {
    if (!st.done) onToggle(st.id);
  });

  const isActive = timer.state !== 'idle';
  // Clamp span so task never extends past midnight (slot 47 = 11:30PM is last slot)
  const maxSlots = 48 - st.startSlot; // slots remaining until end of day
  const wantedRows = st.task.durationMins / 30;
  const spanRows = Math.min(wantedRows, maxSlots);
  const isCompact = spanRows === 1;
  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;

  return (
    <div
      ref={setNodeRef}
      className={`absolute rounded text-xs shadow-sm z-10 overflow-hidden flex flex-col
        ${st.done ? 'opacity-40' : ''}
        ${isDragging ? 'opacity-30 z-50' : ''}`}
      style={{
        borderLeft: `4px solid ${st.task.color}`,
        backgroundColor: `${st.task.color}33`,
        height: `${spanRows * 40 - 2}px`,
        top: '1px',
        left: `${leftPct}%`,
        // Last column: subtract 32px for the + button space. Other columns: normal 2px gap
        width: col + 1 === totalCols ? `calc(${widthPct}% - 34px)` : `calc(${widthPct}% - 2px)`,
      }}
    >
      {/* Timer progress bar — fills left to right */}
      {isActive && (
        <div
          className="absolute inset-0 transition-all duration-1000 pointer-events-none"
          style={{
            backgroundColor: `${st.task.color}40`,
            width: `${timer.progress * 100}%`,
          }}
        />
      )}

      <div className="relative flex flex-col h-full px-2 py-0.5">
        {isCompact ? (
          /* ── COMPACT (30min) — single row ── */
          <div className="flex items-center gap-1 h-full">
            {/* Timer countdown — left side when active */}
            {isActive && (
              <span className="font-mono font-bold text-brand-dark dark:text-white shrink-0">
                {timer.display}
              </span>
            )}

            {/* Drag handle = title area */}
            <span
              {...listeners}
              {...attributes}
              className={`font-semibold text-brand-dark dark:text-white truncate flex-1 cursor-grab active:cursor-grabbing
                ${st.done ? 'line-through' : ''}`}
            >
              {st.task.title}
            </span>

            {/* Timer controls */}
            {timer.state === 'idle' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={timer.start}
                className="text-brand-muted hover:text-brand-accent"
                title="Start timer"
              >
                ⏱
              </button>
            )}
            {timer.state === 'running' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={timer.pause}
                className="text-brand-amber"
                title="Pause"
              >
                ⏸
              </button>
            )}
            {timer.state === 'paused' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={timer.resume}
                className="text-brand-accent"
                title="Resume"
              >
                ▶
              </button>
            )}
            {timer.state === 'done' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={timer.start}
                className="text-brand-green"
                title="Restart"
              >
                ↺
              </button>
            )}
            {isActive && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={timer.stop}
                className="text-red-400"
                title="Stop"
              >
                ⏹
              </button>
            )}

            {/* Checkbox */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onToggle(st.id)}
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                ${st.done ? 'bg-brand-green border-brand-green' : 'border-gray-300'}`}
            >
              {st.done && (
                <span className="text-white leading-none" style={{ fontSize: 8 }}>
                  ✓
                </span>
              )}
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
          /* ── TALL (60min+) — multi row ── */
          <>
            {/* Top row — drag handle on title */}
            <div className="flex justify-between items-start gap-1">
              <span
                {...listeners}
                {...attributes}
                className={`font-semibold text-brand-dark dark:text-white truncate leading-tight cursor-grab active:cursor-grabbing flex-1
                  ${st.done ? 'line-through' : ''}`}
              >
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
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={timer.start}
                    className="text-brand-muted hover:text-brand-accent"
                    title="Start timer"
                  >
                    ⏱
                  </button>
                )}
                {timer.state === 'running' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={timer.pause}
                    className="text-brand-amber"
                    title="Pause"
                  >
                    ⏸
                  </button>
                )}
                {timer.state === 'paused' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={timer.resume}
                    className="text-brand-accent"
                    title="Resume"
                  >
                    ▶
                  </button>
                )}
                {timer.state === 'done' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={timer.start}
                    className="text-brand-green"
                    title="Restart"
                  >
                    ↺
                  </button>
                )}
                {isActive && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={timer.stop}
                    className="text-red-400"
                    title="Stop"
                  >
                    ⏹
                  </button>
                )}
                {!isActive && <span className="text-brand-muted">{st.task.durationMins}m</span>}
              </div>

              {/* Checkbox */}
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
