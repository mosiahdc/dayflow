import { memo, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTimer } from '@/hooks/useTimer';
import { useUIStore } from '@/store/uiStore';
import type { ScheduledTask } from '@/types';

const STORAGE_KEY = 'dayflow-timer-state';

interface PersistedTimer {
  taskId: string;
  totalSecs: number;
  startedAt: number;
  accruedSecs: number;
  state: 'running' | 'paused';
}

function loadPersistedTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return null;
  }
}

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

  const { timerTaskId, setTimerTask } = useUIStore();

  const timer = useTimer(st.task.durationMins, 'countdown', () => {
    if (!st.done) onToggle(st.id);
  });

  // On mount: if this card's task is the globally active timer (restored from
  // localStorage after a refresh), sync the local timer state to match.
  useEffect(() => {
    if (timerTaskId !== st.id) return;
    const saved = loadPersistedTimer();
    if (!saved || saved.taskId !== st.id) return;

    // Calculate remaining seconds the same way TimerOverlay does
    const elapsedSinceResume =
      saved.state === 'running' ? Math.floor((Date.now() - saved.startedAt) / 1000) : 0;
    const totalElapsed = saved.accruedSecs + elapsedSinceResume;
    const restoredRemaining = Math.max(0, saved.totalSecs - totalElapsed);

    if (restoredRemaining <= 0) {
      // Timer already finished — start so the card shows done state
      timer.start();
      return;
    }

    // Kick the local timer into the right state so the card buttons match
    if (saved.state === 'running') {
      timer.start();
    } else {
      // paused: start then immediately pause so state is 'paused'
      timer.start();
      // Small delay needed because start() is async (initialises worker)
      setTimeout(() => timer.pause(), 50);
    }
    // Only run once on mount — deps intentionally omitted beyond the task id check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive display state: if the global overlay owns this card's timer,
  // defer to it; otherwise use the local timer state as normal.
  const isGlobalTimer = timerTaskId === st.id;

  // "isActive" drives the progress bar and countdown display
  const isActive = timer.state !== 'idle';

  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;
  const maxSlots = 48 - st.startSlot;
  const wantedRows = st.task.durationMins / 30;
  const spanRows = Math.min(wantedRows, maxSlots);
  const isCompact = spanRows === 1;

  // When the user clicks pause/resume/stop on the card, also sync the overlay
  const handlePause = () => {
    timer.pause();
    if (isGlobalTimer) {
      // TimerOverlay will pick up the state change via its own pause handler
      // triggered from its own useEffect watching timerTaskId — but we also
      // need to persist the paused state here so overlay reads it correctly
      const saved = loadPersistedTimer();
      if (saved && saved.taskId === st.id) {
        const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...saved,
            accruedSecs: saved.accruedSecs + elapsed,
            state: 'paused',
          } satisfies PersistedTimer)
        );
      }
    }
  };

  const handleResume = () => {
    timer.resume();
    if (isGlobalTimer) {
      const saved = loadPersistedTimer();
      if (saved && saved.taskId === st.id) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...saved,
            startedAt: Date.now(),
            state: 'running',
          } satisfies PersistedTimer)
        );
      }
    }
  };

  const handleStop = () => {
    timer.stop();
    if (isGlobalTimer) {
      localStorage.removeItem(STORAGE_KEY);
      setTimerTask(null);
    }
  };

  const handleStart = () => {
    timer.start();
    setTimerTask(st.id);
  };

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
        width: col + 1 === totalCols ? `calc(${widthPct}% - 34px)` : `calc(${widthPct}% - 2px)`,
      }}
    >
      {/* Timer progress bar */}
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
          /* ── COMPACT (30min) ── */
          <div className="flex items-center gap-1 h-full">
            {isActive && (
              <span className="font-mono font-bold text-brand-dark dark:text-white shrink-0">
                {timer.display}
              </span>
            )}

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
                onClick={handleStart}
                className="text-brand-muted hover:text-brand-accent"
                title="Start timer"
              >
                ⏱
              </button>
            )}
            {timer.state === 'running' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handlePause}
                className="text-brand-amber"
                title="Pause"
              >
                ⏸
              </button>
            )}
            {timer.state === 'paused' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleResume}
                className="text-brand-accent"
                title="Resume"
              >
                ▶
              </button>
            )}
            {timer.state === 'done' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleStart}
                className="text-brand-green"
                title="Restart"
              >
                ↺
              </button>
            )}
            {isActive && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleStop}
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
          /* ── TALL (60min+) ── */
          <>
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

            {isActive && (
              <span className="font-mono font-bold text-brand-dark dark:text-white text-sm leading-none mt-0.5">
                {timer.display}
              </span>
            )}

            <div className="flex justify-between items-center mt-auto">
              <div className="flex items-center gap-1">
                {timer.state === 'idle' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleStart}
                    className="text-brand-muted hover:text-brand-accent"
                    title="Start timer"
                  >
                    ⏱
                  </button>
                )}
                {timer.state === 'running' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handlePause}
                    className="text-brand-amber"
                    title="Pause"
                  >
                    ⏸
                  </button>
                )}
                {timer.state === 'paused' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleResume}
                    className="text-brand-accent"
                    title="Resume"
                  >
                    ▶
                  </button>
                )}
                {timer.state === 'done' && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleStart}
                    className="text-brand-green"
                    title="Restart"
                  >
                    ↺
                  </button>
                )}
                {isActive && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleStop}
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
