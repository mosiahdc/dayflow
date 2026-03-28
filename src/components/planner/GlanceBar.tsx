import { useMemo, useEffect, useRef } from 'react';
import {
  format,
  differenceInSeconds,
  differenceInHours,
  parseISO,
  startOfWeek,
  addDays,
} from 'date-fns';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useFastingStore } from '@/store/fastingStore';

interface Props {
  date: string;
}

function fmtFastElapsed(startedAt: string): string {
  const secs = differenceInSeconds(new Date(), parseISO(startedAt));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function GlanceBarSkeleton() {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-4 animate-pulse"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      <div className="w-8 h-8 rounded-full shrink-0" style={{ background: 'var(--df-border)' }} />
      <div className="flex flex-col gap-1.5">
        <div className="w-20 h-3 rounded" style={{ background: 'var(--df-border)' }} />
        <div className="w-14 h-2.5 rounded" style={{ background: 'var(--df-surface2)' }} />
      </div>
    </div>
  );
}

export default function GlanceBar({ date }: Props) {
  const { scheduledTasks, loading: plannerLoading } = usePlannerStore();
  const { habits, weekEntries, fetchHabits, fetchEntries } = useHabitStore();
  const { active, sessions, fetchSessions } = useFastingStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const isToday = date === today;

  // Track which week we've already fetched entries for so we don't re-fetch
  const fetchedWeekRef = useRef<string | null>(null);
  const fetchedHabitsRef = useRef(false);
  const fetchedFastingRef = useRef(false);

  // Derive the 7 dates of the week containing `date`
  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(date), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  }, [date]);

  const weekKey = weekDates[0] ?? date;

  // Fetch habits once per session
  useEffect(() => {
    if (fetchedHabitsRef.current) return;
    if (habits.length > 0) {
      fetchedHabitsRef.current = true;
      return;
    }
    fetchedHabitsRef.current = true;
    fetchHabits();
  }, [fetchHabits, habits.length]);

  // Fetch habit entries for the current week when date changes
  useEffect(() => {
    if (fetchedWeekRef.current === weekKey) return;
    fetchedWeekRef.current = weekKey;
    fetchEntries(weekDates);
  }, [weekKey, weekDates, fetchEntries]);

  // Fetch fasting sessions once
  useEffect(() => {
    if (fetchedFastingRef.current) return;
    if (sessions.length > 0 || active) {
      fetchedFastingRef.current = true;
      return;
    }
    fetchedFastingRef.current = true;
    fetchSessions();
  }, [fetchSessions, sessions.length, active]);

  // ── Tasks ────────────────────────────────────────────────────────────────
  const dayTasks = useMemo(
    () => scheduledTasks.filter((t) => t.date === date && !t.id.startsWith('overflow-')),
    [scheduledTasks, date]
  );
  const done = dayTasks.filter((t) => t.done).length;
  const total = dayTasks.length;
  const totalMins = dayTasks.reduce((acc, t) => acc + t.task.durationMins, 0);
  const taskPct = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Habits ───────────────────────────────────────────────────────────────
  const dow = DAY_KEYS[new Date(date).getDay()];
  const todayHabits = habits.filter((h) => {
    // Only count habits that existed on this date (created on or before this date)
    const createdDate = h.createdAt.slice(0, 10);
    return h.targetDays.includes(dow as (typeof DAY_KEYS)[number]) && createdDate <= date;
  });
  const completedHabits = weekEntries.filter(
    (e) => e.date === date && e.completed && todayHabits.some((h) => h.id === e.habitId)
  ).length;

  // Show skeleton while planner is loading
  if (plannerLoading) return <GlanceBarSkeleton />;

  // ── Fasting for this specific date ────────────────────────────────────────
  // For today: show the active fast if running
  // For any date: find completed sessions that started on that date
  const dateSessions = sessions.filter((s) => {
    const sessionDate = format(parseISO(s.startedAt), 'yyyy-MM-dd');
    return sessionDate === date && s.endedAt;
  });
  const totalFastedSecs = dateSessions.reduce((acc, s) => {
    return acc + differenceInSeconds(parseISO(s.endedAt!), parseISO(s.startedAt));
  }, 0);
  // Find the session with the longest duration — avoid reduce with null initial value
  // which causes TypeScript inference issues
  const bestSession =
    dateSessions.length === 0
      ? null
      : dateSessions.reduce((best, s) => {
          const dur = differenceInSeconds(parseISO(s.endedAt!), parseISO(s.startedAt));
          const bestDur = differenceInSeconds(parseISO(best.endedAt!), parseISO(best.startedAt));
          return dur > bestDur ? s : best;
        });
  const goalMet = bestSession
    ? differenceInHours(parseISO(bestSession.endedAt!), parseISO(bestSession.startedAt)) >=
      bestSession.goalHours
    : false;

  const hasFasting = (active && isToday) || dateSessions.length > 0;

  // Hide only when there is genuinely nothing to show
  const hasAnything = total > 0 || todayHabits.length > 0 || hasFasting;
  if (!hasAnything) return null;

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 items-center"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      {/* Tasks */}
      {total > 0 && (
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative w-8 h-8 shrink-0">
            <svg viewBox="0 0 32 32" className="-rotate-90 w-full h-full">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="var(--df-border2)"
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={taskPct === 100 ? 'var(--df-green)' : 'var(--df-accent)'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 12}
                strokeDashoffset={2 * Math.PI * 12 * (1 - taskPct / 100)}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
              {taskPct}%
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--df-text)' }}>
              {done}/{total} tasks
            </p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--df-muted)' }}>
              {fmtHours(totalMins)} planned
            </p>
          </div>
        </div>
      )}

      {/* Divider */}
      {total > 0 && (todayHabits.length > 0 || (active && isToday)) && (
        <div
          className="w-px h-8 shrink-0 hidden sm:block"
          style={{ background: 'var(--df-border)' }}
        />
      )}

      {/* Habits */}
      {todayHabits.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {todayHabits.map((h) => {
              const completed = weekEntries.some(
                (e) => e.habitId === h.id && e.date === date && e.completed
              );
              return (
                <div
                  key={h.id}
                  title={h.title}
                  className={`w-3.5 h-3.5 rounded-sm transition-all ${completed ? '' : 'opacity-20'}`}
                  style={{ backgroundColor: h.color }}
                />
              );
            })}
          </div>
          <p className="text-xs" style={{ color: 'var(--df-text)' }}>
            <span className="font-semibold">{completedHabits}</span>
            <span style={{ color: 'var(--df-muted)' }}>/{todayHabits.length} habits</span>
          </p>
        </div>
      )}

      {/* Fasting divider */}
      {(todayHabits.length > 0 || total > 0) && hasFasting && (
        <div
          className="w-px h-8 shrink-0 hidden sm:block"
          style={{ background: 'var(--df-border)' }}
        />
      )}

      {/* Fasting — active (today) */}
      {active && isToday && (
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full df-pulse shrink-0"
            style={{ background: '#6366f1' }}
          />
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--df-text)' }}>
              {fmtFastElapsed(active.startedAt)} fasting
            </p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--df-muted)' }}>
              Goal: {active.goalHours}h
            </p>
          </div>
        </div>
      )}

      {/* Fasting — completed sessions on this date */}
      {!isToday && dateSessions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={`text-sm shrink-0 ${goalMet ? '' : 'opacity-60'}`}>
            {goalMet ? '🏆' : '🕐'}
          </span>
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--df-text)' }}>
              {fmtHours(Math.round(totalFastedSecs / 60))} fasted
              {goalMet && (
                <span className="ml-1 text-[10px]" style={{ color: 'var(--df-green)' }}>
                  ✓ goal
                </span>
              )}
            </p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--df-muted)' }}>
              {dateSessions.length} session{dateSessions.length > 1 ? 's' : ''}
              {bestSession && ` · goal ${bestSession.goalHours}h`}
            </p>
          </div>
        </div>
      )}

      {/* Today: also show completed sessions from earlier today alongside active */}
      {isToday && dateSessions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
            +{fmtHours(Math.round(totalFastedSecs / 60))} earlier
          </span>
        </div>
      )}

      {/* Perfect day */}
      {total > 0 &&
        done === total &&
        todayHabits.length > 0 &&
        completedHabits === todayHabits.length && (
          <div
            className="ml-auto text-xs font-semibold flex items-center gap-1"
            style={{ color: 'var(--df-green)' }}
          >
            <span>✨</span>
            <span>Perfect day!</span>
          </div>
        )}
    </div>
  );
}
