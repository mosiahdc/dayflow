import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';

// ── Persistence key ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'dayflow-timer-state';

interface PersistedTimer {
  taskId: string;
  totalSecs: number;
  startedAt: number; // Date.now() when timer started (or resumed)
  accruedSecs: number; // seconds already elapsed before last start/resume
  state: 'running' | 'paused';
}

function saveTimer(data: PersistedTimer) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearTimer() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return null;
  }
}

// Calculate how many seconds remain given persisted state
function calcRemaining(saved: PersistedTimer): number {
  if (saved.state === 'paused') {
    return saved.totalSecs - saved.accruedSecs;
  }
  // running — add elapsed since startedAt
  const elapsedSinceResume = Math.floor((Date.now() - saved.startedAt) / 1000);
  const totalElapsed = saved.accruedSecs + elapsedSinceResume;
  return Math.max(0, saved.totalSecs - totalElapsed);
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TimerOverlay() {
  const { timerTaskId, setTimerTask, setView, setDate } = useUIStore();
  const { scheduledTasks, toggleDone } = usePlannerStore();

  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [remaining, setRemaining] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const prevTaskIdRef = useRef<string | null>(null);
  // Tracks accrued seconds before the current running period (for pause/resume)
  const accruedSecsRef = useRef(0);
  const startedAtRef = useRef(0);

  const task = timerTaskId ? (scheduledTasks.find((t) => t.id === timerTaskId) ?? null) : null;

  // ── Restore from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    const saved = loadTimer();
    if (!saved) return;

    // Wait until scheduledTasks are loaded before restoring
    if (scheduledTasks.length === 0) return;

    const found = scheduledTasks.find((t) => t.id === saved.taskId);
    if (!found) {
      clearTimer();
      return;
    }

    const restoredRemaining = calcRemaining(saved);

    // If timer already finished while page was closed
    if (restoredRemaining <= 0) {
      setTimerTask(saved.taskId);
      setTotalSecs(saved.totalSecs);
      setRemaining(0);
      setTimerState('done');
      prevTaskIdRef.current = saved.taskId;
      clearTimer();
      return;
    }

    // Restore running or paused state
    setTimerTask(saved.taskId);
    setTotalSecs(saved.totalSecs);
    setRemaining(restoredRemaining);
    setTimerState(saved.state);
    prevTaskIdRef.current = saved.taskId;
    accruedSecsRef.current = saved.totalSecs - restoredRemaining;
    startedAtRef.current = Date.now();

    if (saved.state === 'running') {
      // Spin up worker with restored remaining
      workerRef.current?.terminate();
      workerRef.current = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current.onmessage = (e: MessageEvent) => {
        const { type, remaining: r } = e.data as { type: string; remaining?: number };
        if (type === 'TICK') {
          setRemaining(r ?? 0);
          accruedSecsRef.current = saved.totalSecs - (r ?? 0);
        }
        if (type === 'DONE') {
          setTimerState('done');
          setRemaining(0);
          clearTimer();
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('DayFlow ✓', { body: `"${found.task.title}" timer complete!` });
          }
        }
      };
      workerRef.current.postMessage({ type: 'START', duration: restoredRemaining });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledTasks]);

  // ── Start when a new timerTaskId is set from TaskCard ─────────────────────
  useEffect(() => {
    if (!timerTaskId || timerTaskId === prevTaskIdRef.current) return;
    prevTaskIdRef.current = timerTaskId;

    const found = scheduledTasks.find((t) => t.id === timerTaskId);
    if (!found) return;

    const secs = found.task.durationMins * 60;
    setTotalSecs(secs);
    setRemaining(secs);
    setTimerState('running');
    setMinimized(false);
    accruedSecsRef.current = 0;
    startedAtRef.current = Date.now();

    // Persist immediately
    saveTimer({
      taskId: timerTaskId,
      totalSecs: secs,
      startedAt: startedAtRef.current,
      accruedSecs: 0,
      state: 'running',
    });

    workerRef.current?.terminate();
    workerRef.current = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current.onmessage = (e: MessageEvent) => {
      const { type, remaining: r } = e.data as { type: string; remaining?: number };
      if (type === 'TICK') {
        setRemaining(r ?? 0);
        accruedSecsRef.current = secs - (r ?? 0);
        // Keep localStorage in sync every tick
        saveTimer({
          taskId: timerTaskId,
          totalSecs: secs,
          startedAt: startedAtRef.current,
          accruedSecs: accruedSecsRef.current,
          state: 'running',
        });
      }
      if (type === 'DONE') {
        setTimerState('done');
        setRemaining(0);
        clearTimer();
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('DayFlow ✓', { body: `"${found.task.title}" timer complete!` });
        }
      }
    };
    workerRef.current.postMessage({ type: 'START', duration: secs });
  }, [timerTaskId, scheduledTasks]);

  // Cleanup worker on unmount
  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    []
  );

  const pause = useCallback(() => {
    setTimerState('paused');
    workerRef.current?.postMessage({ type: 'PAUSE' });
    if (timerTaskId) {
      saveTimer({
        taskId: timerTaskId,
        totalSecs,
        startedAt: startedAtRef.current,
        accruedSecs: accruedSecsRef.current,
        state: 'paused',
      });
    }
  }, [timerTaskId, totalSecs]);

  const resume = useCallback(() => {
    setTimerState('running');
    startedAtRef.current = Date.now();
    workerRef.current?.postMessage({ type: 'RESUME' });
    if (timerTaskId) {
      saveTimer({
        taskId: timerTaskId,
        totalSecs,
        startedAt: startedAtRef.current,
        accruedSecs: accruedSecsRef.current,
        state: 'running',
      });
    }
  }, [timerTaskId, totalSecs]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' });
    workerRef.current?.terminate();
    workerRef.current = null;
    setTimerState('idle');
    setRemaining(0);
    setTotalSecs(0);
    accruedSecsRef.current = 0;
    prevTaskIdRef.current = null;
    clearTimer();
    setTimerTask(null);
  }, [setTimerTask]);

  const markDone = useCallback(() => {
    if (timerTaskId) toggleDone(timerTaskId);
    stop();
  }, [timerTaskId, toggleDone, stop]);

  const jumpToTask = useCallback(() => {
    if (!task) return;
    setDate(task.date);
    setView('day');
  }, [task, setDate, setView]);

  // Don't render when nothing is active
  if (!timerTaskId || !task || timerState === 'idle') return null;

  const progress = totalSecs > 0 ? 1 - remaining / totalSecs : 0;
  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference * (1 - progress);
  const isDone = timerState === 'done';
  const isPaused = timerState === 'paused';

  return (
    <div
      className="fixed z-50 select-none bottom-20 right-3 md:bottom-4 md:right-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {minimized ? (
        // ── Minimized pill ────────────────────────────────────────────────
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-xl text-sm font-mono font-bold text-white transition-all border
            ${isDone ? 'bg-brand-green border-brand-green' : isPaused ? 'bg-gray-600 border-gray-500' : 'bg-brand-dark border-gray-600'}`}
          style={{ borderLeftColor: task.task.color, borderLeftWidth: 3 }}
        >
          <svg width="18" height="18" className="-rotate-90">
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
            />
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke={isDone ? '#fff' : task.task.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 7}
              strokeDashoffset={2 * Math.PI * 7 * (1 - progress)}
            />
          </svg>
          <span>{isDone ? 'Done!' : fmtTime(remaining)}</span>
          {isPaused && <span className="text-xs opacity-70">paused</span>}
        </button>
      ) : (
        // ── Expanded card ─────────────────────────────────────────────────
        <div
          className="bg-brand-dark border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 220 }}
        >
          <div className="h-1 w-full" style={{ backgroundColor: task.task.color }} />
          <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-white truncate flex-1 mr-2">
                {task.task.title}
              </p>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setMinimized(true)}
                  className="text-gray-500 hover:text-gray-300 text-sm px-1"
                  title="Minimize"
                >
                  ─
                </button>
                <button
                  onClick={stop}
                  className="text-gray-500 hover:text-red-400 text-sm px-1"
                  title="Stop timer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Circular progress ring */}
            <div className="flex justify-center mb-3">
              <div className="relative w-20 h-20">
                <svg width="80" height="80" className="-rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="20"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="20"
                    fill="none"
                    stroke={isDone ? '#10B981' : task.task.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isDone ? (
                    <span className="text-brand-green text-2xl">✓</span>
                  ) : (
                    <>
                      <span className="font-mono font-bold text-white text-sm leading-tight">
                        {fmtTime(remaining)}
                      </span>
                      <span className="text-xs text-gray-500">{task.task.durationMins}m</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Jump to task */}
            <button
              onClick={jumpToTask}
              className="w-full text-left mb-3 hover:opacity-80 transition-opacity"
            >
              <p className="text-xs text-gray-500 capitalize">
                {task.task.category} · {task.date}
              </p>
            </button>

            {/* Controls */}
            {isDone ? (
              <div className="flex gap-2">
                <button
                  onClick={markDone}
                  className="flex-1 bg-brand-green text-white rounded-lg py-1.5 text-xs font-semibold hover:opacity-90"
                >
                  ✓ Mark done
                </button>
                <button
                  onClick={stop}
                  className="flex-1 bg-gray-700 text-gray-300 rounded-lg py-1.5 text-xs hover:bg-gray-600"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {timerState === 'running' ? (
                  <button
                    onClick={pause}
                    className="flex-1 bg-gray-700 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-gray-600"
                  >
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    onClick={resume}
                    className="flex-1 text-white rounded-lg py-1.5 text-xs font-semibold hover:opacity-90"
                    style={{ backgroundColor: task.task.color }}
                  >
                    ▶ Resume
                  </button>
                )}
                <button
                  onClick={markDone}
                  className="flex-1 bg-brand-green text-white rounded-lg py-1.5 text-xs font-semibold hover:opacity-90"
                >
                  ✓ Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
