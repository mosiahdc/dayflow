import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { usePlannerStore } from '@/store/plannerStore';
import {
  useTaskHoursStore,
  WEEK_DAY_ORDER,
  WEEK_DAY_LABELS,
  EMPTY_WEEKLY_HOURS,
  sumWeeklyHours,
  type DayKey,
  type WeeklyHours,
} from '@/store/taskHoursStore';
import {
  calendarMonday,
  getWorkWeekStart,
  getWorkWeekFetchRange,
  dayKeyOf,
  workWeekLabel,
} from '@/lib/workWeek';
import type { Task } from '@/types';

interface Props {
  date: string; // selected date from the Day view
}

function fmtHrs(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}h`;
}

function fmtMinsAsHrs(mins: number): number {
  return Math.round((mins / 60) * 10) / 10;
}

// Stacked progress bar: solid fill = completed, faint fill = scheduled-but-not-done yet,
// remaining track = still open. Falls back to a soft cap when no target is set, so
// untracked-but-active tasks still get a meaningful bar instead of an empty one.
function ProgressBar({
  completed,
  scheduled,
  target,
}: {
  completed: number;
  scheduled: number;
  target: number;
}) {
  const max = target > 0 ? target : Math.max(scheduled, completed, 1);
  const completedPct = Math.min(100, (completed / max) * 100);
  const scheduledPct = Math.min(100, (scheduled / max) * 100);
  const overTarget = target > 0 && completed >= target;

  return (
    <div
      className="relative w-full h-2.5 rounded-full overflow-hidden shrink-0"
      style={{ background: 'var(--df-border)' }}
    >
      {scheduledPct > completedPct && (
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${scheduledPct}%`, background: 'var(--df-accent)', opacity: 0.25 }}
        />
      )}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{
          width: `${completedPct}%`,
          background: overTarget ? 'var(--df-green)' : 'var(--df-accent)',
        }}
      />
    </div>
  );
}

interface TaskHoursRow {
  task: Task;
  targetHours: number;
  targets: WeeklyHours;
  scheduledHours: number;
  completedHours: number;
  actualByDay: Record<DayKey, number>; // completed hours per weekday
}

export default function WorkHoursPanel({ date }: Props) {
  const { tasks, fetchAll: fetchAllTasks } = useTaskStore();
  const { scheduledTasks, fetchByWeek } = usePlannerStore();
  const {
    targets,
    loading: targetsLoading,
    fetchForWeek,
    upsertTargets,
    copyPreviousWeek,
    removeTargets,
  } = useTaskHoursStore();

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WeeklyHours>(EMPTY_WEEKLY_HOURS);
  const [saving, setSaving] = useState(false);
  const [addingTaskId, setAddingTaskId] = useState('');

  const weekStart = useMemo(() => calendarMonday(date), [date]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    const { start, end } = getWorkWeekFetchRange(weekStart);
    fetchByWeek(start, end);
    fetchForWeek(weekStart);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const workTasks = useMemo(() => tasks.filter((t) => t.category === 'work'), [tasks]);

  const rows: TaskHoursRow[] = useMemo(() => {
    return workTasks.map((task) => {
      const targetRow = targets.find((t) => t.taskId === task.id && t.weekStart === weekStart);
      const taskTargets = targetRow?.targets ?? EMPTY_WEEKLY_HOURS;

      const relevant = scheduledTasks.filter(
        (st) =>
          st.taskId === task.id &&
          !st.id.startsWith('overflow-') &&
          getWorkWeekStart(st.date, st.startSlot) === weekStart
      );

      const scheduledMins = relevant.reduce((acc, st) => acc + st.task.durationMins, 0);
      const completedMins = relevant
        .filter((st) => st.done)
        .reduce((acc, st) => acc + st.task.durationMins, 0);

      const actualByDay = { ...EMPTY_WEEKLY_HOURS } as Record<DayKey, number>;
      for (const st of relevant) {
        if (!st.done) continue;
        const key = dayKeyOf(st.date);
        actualByDay[key] += st.task.durationMins;
      }
      (Object.keys(actualByDay) as DayKey[]).forEach((k) => {
        actualByDay[k] = fmtMinsAsHrs(actualByDay[k]);
      });

      return {
        task,
        targetHours: sumWeeklyHours(taskTargets),
        targets: taskTargets,
        scheduledHours: fmtMinsAsHrs(scheduledMins),
        completedHours: fmtMinsAsHrs(completedMins),
        actualByDay,
      };
    });
  }, [workTasks, targets, scheduledTasks, weekStart]);

  // Only show tasks that are tracked (have a target) or already have activity this week
  const visibleRows = rows.filter((r) => r.targetHours > 0 || r.scheduledHours > 0);
  const untrackedTasks = workTasks.filter((t) => !visibleRows.some((r) => r.task.id === t.id));

  const totalTarget = visibleRows.reduce((acc, r) => acc + r.targetHours, 0);
  const totalCompleted = visibleRows.reduce((acc, r) => acc + r.completedHours, 0);
  const totalScheduled = visibleRows.reduce((acc, r) => acc + r.scheduledHours, 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0;

  const startEdit = (row: TaskHoursRow) => {
    setExpandedTaskId(row.task.id);
    setDraft(row.targets);
  };

  const closeEdit = () => {
    setExpandedTaskId(null);
    setDraft(EMPTY_WEEKLY_HOURS);
  };

  const saveEdit = async (taskId: string) => {
    setSaving(true);
    await upsertTargets(taskId, weekStart, draft);
    setSaving(false);
    closeEdit();
  };

  const handleCopyPrevious = async (taskId: string) => {
    const prev = await copyPreviousWeek(taskId, weekStart);
    if (prev) setDraft(prev);
  };

  const handleRemove = async (taskId: string) => {
    await removeTargets(taskId, weekStart);
    if (expandedTaskId === taskId) closeEdit();
  };

  const handleAddTask = async (taskId: string) => {
    if (!taskId) return;
    await upsertTargets(taskId, weekStart, EMPTY_WEEKLY_HOURS);
    setAddingTaskId('');
    setExpandedTaskId(taskId);
    setDraft(EMPTY_WEEKLY_HOURS);
  };

  if (workTasks.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex flex-col gap-1.5" style={{ borderBottom: '1px solid var(--df-border)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--df-text)' }}>
            🕐 Work Hours This Week
          </span>
          {totalTarget > 0 && (
            <span
              className="text-xs font-bold shrink-0"
              style={{ color: overallPct >= 100 ? 'var(--df-green)' : 'var(--df-accent)' }}
            >
              {overallPct}%
            </span>
          )}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
          {workWeekLabel(weekStart)}
        </span>
        {totalTarget > 0 && (
          <>
            <ProgressBar completed={totalCompleted} scheduled={totalScheduled} target={totalTarget} />
            <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
              {fmtHrs(totalCompleted)} done of {fmtHrs(totalTarget)}h target
              {totalScheduled > totalCompleted ? ` · ${fmtHrs(totalScheduled)}h scheduled` : ''}
            </span>
          </>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {visibleRows.length === 0 && !targetsLoading && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--df-muted)' }}>
            No work hours tracked yet this week.
          </p>
        )}

        {visibleRows.map((row) => {
          const isExpanded = expandedTaskId === row.task.id;
          const pct =
            row.targetHours > 0 ? Math.min(100, Math.round((row.completedHours / row.targetHours) * 100)) : 0;
          return (
            <div key={row.task.id} style={{ borderTop: '1px solid var(--df-border)' }}>
              <button
                onClick={() => (isExpanded ? closeEdit() : startEdit(row))}
                className="w-full flex flex-col gap-1.5 px-4 py-3 text-left hover:brightness-110 transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: row.task.color }} />
                  <p className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--df-text)' }}>
                    {row.task.title}
                  </p>
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{
                      color:
                        row.targetHours > 0
                          ? pct >= 100
                            ? 'var(--df-green)'
                            : 'var(--df-accent)'
                          : 'var(--df-muted)',
                    }}
                  >
                    {row.targetHours > 0 ? `${pct}%` : fmtHrs(row.completedHours)}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--df-muted)' }}>
                    {isExpanded ? '▲' : '✎'}
                  </span>
                </div>

                <ProgressBar completed={row.completedHours} scheduled={row.scheduledHours} target={row.targetHours} />

                <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
                  {row.targetHours > 0
                    ? `${fmtHrs(row.completedHours)}h done of ${fmtHrs(row.targetHours)}h target${
                        row.scheduledHours > row.completedHours ? ` · ${fmtHrs(row.scheduledHours)}h scheduled` : ''
                      }`
                    : `${fmtHrs(row.completedHours)}h logged this week · no target set`}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                  <div className="grid grid-cols-7 gap-1">
                    {WEEK_DAY_ORDER.map((key) => (
                      <div key={key} className="flex flex-col items-center gap-0.5">
                        <label className="text-[10px] font-semibold" style={{ color: 'var(--df-muted)' }}>
                          {WEEK_DAY_LABELS[key]}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={draft[key] === 0 ? '' : draft[key]}
                          placeholder="0"
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setDraft((d) => ({ ...d, [key]: isNaN(v) ? 0 : Math.max(0, Math.min(24, v)) }));
                          }}
                          className="w-full text-center text-xs rounded px-1 py-1"
                          style={{
                            background: 'var(--df-surface2)',
                            border: '1px solid var(--df-border2)',
                            color: 'var(--df-text)',
                          }}
                        />
                        <span className="text-[9px]" style={{ color: 'var(--df-muted)' }}>
                          {row.actualByDay[key] > 0 ? `${fmtHrs(row.actualByDay[key])} done` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyPrevious(row.task.id)}
                        className="text-[11px] px-2 py-1 rounded"
                        style={{ color: 'var(--df-accent)', border: '1px solid var(--df-border2)' }}
                      >
                        Copy last week
                      </button>
                      <button
                        onClick={() => handleRemove(row.task.id)}
                        className="text-[11px] px-2 py-1 rounded"
                        style={{ color: 'var(--df-red)', border: '1px solid var(--df-border2)' }}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={closeEdit}
                        className="text-[11px] px-3 py-1 rounded"
                        style={{ color: 'var(--df-muted)', border: '1px solid var(--df-border2)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(row.task.id)}
                        disabled={saving}
                        className="text-[11px] px-3 py-1 rounded font-semibold text-white disabled:opacity-50"
                        style={{ background: 'var(--df-accent)' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add a work task to track */}
      {untrackedTasks.length > 0 && (
        <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--df-border)' }}>
          <select
            value={addingTaskId}
            onChange={(e) => handleAddTask(e.target.value)}
            className="w-full text-xs rounded px-2 py-1.5"
            style={{
              background: 'var(--df-surface2)',
              border: '1px solid var(--df-border2)',
              color: 'var(--df-muted)',
            }}
          >
            <option value="">+ Track a work task…</option>
            {untrackedTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
