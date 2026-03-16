import { useEffect, useState, useRef } from 'react';
import { format, differenceInSeconds, differenceInDays, parseISO, subDays } from 'date-fns';
import { useFastingStore } from '@/store/fastingStore';

// ─── helpers ───────────────────────────────────────────────────────────────
function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtHoursMinutes(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function localDatetimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const GOAL_OPTIONS = [12, 14, 16, 18, 20, 24, 36, 48];

// ─── Streak calculator ─────────────────────────────────────────────────────
// A day "has a fast" if any completed session overlaps that calendar date.
// Streak = consecutive days going back from today that have a fast.
// 36h fast crosses two days — both count.
function calcStreak(sessions: { startedAt: string; endedAt: string | null }[]) {
  const completed = sessions.filter((s) => s.endedAt);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Build a set of date strings that have fasting activity
  const fastedDays = new Set<string>();
  for (const s of completed) {
    const start = parseISO(s.startedAt);
    const end = parseISO(s.endedAt!);
    const days = differenceInDays(end, start) + 1;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      fastedDays.add(format(d, 'yyyy-MM-dd'));
    }
  }

  let streak = 0;
  let current = new Date();
  for (let i = 0; i < 365; i++) {
    const key = format(current, 'yyyy-MM-dd');
    if (fastedDays.has(key)) {
      streak++;
    } else if (i > 0) {
      break; // gap found — stop
    }
    // i === 0 and today not fasted yet — still checking, don't break
    current = subDays(current, 1);
  }
  return streak;
}

// ─── Main component ────────────────────────────────────────────────────────
export default function FastingTracker() {
  const {
    sessions,
    active,
    loading,
    fetchSessions,
    startFast,
    updateStartTime,
    stopFast,
    deletSession,
  } = useFastingStore();

  const [now, setNow] = useState(new Date());
  const [goalHours, setGoalHours] = useState(16);
  const [editingStart, setEditingStart] = useState(false);
  const [editingStop, setEditingStop] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [stopInput, setStopInput] = useState('');
  // history always visible below timer
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock — ticks every second
  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const elapsed = active ? Math.max(0, differenceInSeconds(now, parseISO(active.startedAt))) : 0;
  const goalSeconds = (active?.goalHours ?? goalHours) * 3600;
  const progress = Math.min(1, elapsed / goalSeconds);
  const goalReached = elapsed >= goalSeconds;
  const completedSessions = sessions.filter((s) => s.endedAt);
  const streak = calcStreak(sessions);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStart = () => {
    startFast(new Date(), goalHours);
  };

  const handleStop = () => {
    if (!active) return;
    setStopInput(localDatetimeValue(new Date()));
    setEditingStop(true);
  };

  const confirmStop = () => {
    if (!active) return;
    const d = new Date(stopInput);
    if (isNaN(d.getTime())) return;
    stopFast(active.id, d);
    setEditingStop(false);
  };

  const handleEditStart = () => {
    if (!active) return;
    setStartInput(localDatetimeValue(parseISO(active.startedAt)));
    setEditingStart(true);
  };

  const confirmEditStart = () => {
    if (!active) return;
    const d = new Date(startInput);
    if (isNaN(d.getTime())) return;
    updateStartTime(active.id, d);
    setEditingStart(false);
  };

  // ── Circular progress ─────────────────────────────────────────────────────
  const R = 70;
  const C = 2 * Math.PI * R;
  const arc = C * (1 - progress);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🕐</span>
          <span className="font-semibold text-sm">Intermittent Fasting</span>
          {streak > 0 && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
              🔥 {streak} day streak
            </span>
          )}
        </div>
      </div>

      {loading && <div className="p-6 text-center text-sm text-gray-400">Loading…</div>}

      {/* ── TIMER VIEW ── */}
      {!loading && (
        <div className="p-6 flex flex-col items-center gap-4">
          {/* Circular progress ring */}
          <div className="relative">
            <svg width="180" height="180" className="-rotate-90">
              <circle
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="10"
                className="dark:stroke-gray-700"
              />
              <circle
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={goalReached ? '#10B981' : '#6366f1'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={arc}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {active ? (
                <>
                  <span className="font-mono font-bold text-2xl dark:text-white">
                    {fmtDuration(elapsed)}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">
                    {goalReached ? '✅ Goal reached!' : `of ${active.goalHours}h goal`}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-3xl">🍽️</span>
                  <span className="text-xs text-gray-400 mt-1">Not fasting</span>
                </>
              )}
            </div>
          </div>

          {/* Active fast info */}
          {active && (
            <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Started</span>
                <span className="font-medium dark:text-white">
                  {format(parseISO(active.startedAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Goal</span>
                <span className="font-medium dark:text-white">{active.goalHours}h fast</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Break fast at</span>
                <span className="font-medium text-indigo-500">
                  {format(
                    new Date(parseISO(active.startedAt).getTime() + active.goalHours * 3600000),
                    'MMM d, h:mm a'
                  )}
                </span>
              </div>

              {/* Edit start time */}
              {editingStart ? (
                <div className="flex gap-2 mt-1">
                  <input
                    type="datetime-local"
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    className="flex-1 text-xs border rounded px-2 py-1 dark:bg-gray-600 dark:text-white dark:border-gray-500"
                  />
                  <button
                    onClick={confirmEditStart}
                    className="text-xs bg-indigo-500 text-white px-2 py-1 rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingStart(false)}
                    className="text-xs text-gray-400 px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEditStart}
                  className="text-xs text-indigo-400 hover:text-indigo-600 text-left mt-0.5"
                >
                  ✏️ Adjust start time
                </button>
              )}
            </div>
          )}

          {/* Goal selector (only when not active) */}
          {!active && (
            <div className="w-full">
              <p className="text-xs text-gray-400 mb-2 text-center">Select fasting goal</p>
              <div className="grid grid-cols-4 gap-1.5">
                {GOAL_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setGoalHours(h)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${
                        goalHours === h
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-100'
                      }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stop — edit end time */}
          {editingStop && (
            <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Adjust stop time</p>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={stopInput}
                  onChange={(e) => setStopInput(e.target.value)}
                  className="flex-1 text-xs border rounded px-2 py-1 dark:bg-gray-600 dark:text-white dark:border-gray-500"
                />
                <button
                  onClick={confirmStop}
                  className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setEditingStop(false)}
                  className="text-xs text-gray-400 px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Start / Stop buttons */}
          {!editingStop && (
            <div className="flex gap-3 w-full">
              {!active ? (
                <button
                  onClick={handleStart}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
                >
                  🚀 Start Fast
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
                >
                  🛑 Stop Fast
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {/* ── HISTORY ── */}
      {!loading && (
        <div className="flex flex-col">
          <div className="px-4 pt-3 pb-1 border-t dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Fasting History
            </h3>
          </div>
          {completedSessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No completed fasts yet.</p>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {completedSessions.map((s) => {
                const dur = differenceInSeconds(parseISO(s.endedAt!), parseISO(s.startedAt));
                const pct = Math.min(100, Math.round((dur / (s.goalHours * 3600)) * 100));
                return (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                    {/* Progress bar */}
                    <div className="w-10 h-10 shrink-0 relative">
                      <svg viewBox="0 0 40 40" className="-rotate-90 w-full h-full">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="4"
                          className="dark:stroke-gray-600"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke={pct >= 100 ? '#10B981' : '#6366f1'}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 * (1 - pct / 100)}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold dark:text-white">
                        {pct}%
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold dark:text-white">
                        {fmtHoursMinutes(dur)}
                        {pct >= 100 && <span className="ml-1 text-green-500 text-xs">✅</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(parseISO(s.startedAt), 'MMM d, h:mm a')} →{' '}
                        {format(parseISO(s.endedAt!), 'h:mm a')}
                      </p>
                      <p className="text-xs text-gray-400">Goal: {s.goalHours}h</p>
                    </div>

                    <button
                      onClick={() => deletSession(s.id)}
                      className="text-gray-300 hover:text-red-400 text-sm shrink-0"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
