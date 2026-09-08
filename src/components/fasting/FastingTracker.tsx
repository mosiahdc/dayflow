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


  // ── Render ────────────────────────────────────────────────────────────────
  const recentSessions = completedSessions.filter((s) => differenceInDays(now, parseISO(s.endedAt!)) <= 6);
  const avgSeconds = completedSessions.length
    ? Math.round(completedSessions.reduce((sum, s) => sum + differenceInSeconds(parseISO(s.endedAt!), parseISO(s.startedAt)), 0) / completedSessions.length)
    : 0;
  const bestSeconds = completedSessions.reduce((best, s) => Math.max(best, differenceInSeconds(parseISO(s.endedAt!), parseISO(s.startedAt))), 0);
  const goalHits = completedSessions.filter((s) => differenceInSeconds(parseISO(s.endedAt!), parseISO(s.startedAt)) >= s.goalHours * 3600).length;
  const goalRate = completedSessions.length ? Math.round((goalHits / completedSessions.length) * 100) : 0;
  const progressPct = Math.min(100, Math.round(progress * 100));
  const R2 = 92;
  const C2 = 2 * Math.PI * R2;
  const arc2 = C2 * (1 - progress);

  return (
    <div className="df-fast-workspace">
      <section className="df-fast-hero-strip">
        <div>
          <span className="df-kicker">FASTING RHYTHM</span>
          <h2>{active ? 'Stay inside the window.' : 'Choose the window that fits your day.'}</h2>
          <p>{active ? 'The timer is running. Keep the decision simple and let the clock do the work.' : 'Start with a realistic goal and use your history to adjust over time.'}</p>
        </div>
        <div className="df-inline-actions">
          {streak > 0 && <span className="df-chip is-amber">🔥 {streak} day streak</span>}
          <span className="df-chip is-blue">{recentSessions.length} fasts · last 7 days</span>
        </div>
      </section>

      {loading ? (
        <div className="df-page-section df-empty-state"><strong>Loading fasting data…</strong></div>
      ) : (
        <>
          <section className="df-fast-dashboard">
            <div className="df-fast-timer-card">
              <div className="df-fast-timer-label">
                <span className="df-kicker">CURRENT WINDOW</span>
                <span className={`df-pill ${goalReached ? 'is-green' : 'is-blue'}`}>{active ? `${progressPct}% complete` : `${goalHours}h target`}</span>
              </div>

              <div className="df-fast-ring-wrap">
                <svg width="236" height="236" className="-rotate-90" aria-label="Fasting progress">
                  <circle cx="118" cy="118" r={R2} fill="none" stroke="var(--df-surface3)" strokeWidth="14" />
                  <circle
                    cx="118"
                    cy="118"
                    r={R2}
                    fill="none"
                    stroke={goalReached ? 'var(--df-green)' : 'var(--df-accent)'}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={C2}
                    strokeDashoffset={arc2}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="df-fast-ring-center">
                  {active ? (
                    <>
                      <strong>{fmtDuration(elapsed)}</strong>
                      <span>{goalReached ? 'Goal reached' : `of ${active.goalHours} hours`}</span>
                    </>
                  ) : (
                    <>
                      <strong>{goalHours}h</strong>
                      <span>ready to start</span>
                    </>
                  )}
                </div>
              </div>

              {!active && (
                <div className="df-fast-goal-grid">
                  {GOAL_OPTIONS.map((h) => (
                    <button key={h} onClick={() => setGoalHours(h)} className={`df-fast-goal ${goalHours === h ? 'is-active' : ''}`}>
                      <b>{h}h</b><span>{h < 16 ? 'light' : h <= 20 ? 'standard' : 'extended'}</span>
                    </button>
                  ))}
                </div>
              )}

              {!editingStop && (
                !active ? (
                  <button onClick={handleStart} className="df-fast-primary-action">Start fast</button>
                ) : (
                  <button onClick={handleStop} className="df-fast-primary-action is-stop">End fast</button>
                )
              )}
            </div>

            <div className="df-fast-side">
              <div className="df-fast-stat-grid">
                <div className="df-fast-stat"><span>Average</span><strong>{avgSeconds ? fmtHoursMinutes(avgSeconds) : '—'}</strong><small>all completed fasts</small></div>
                <div className="df-fast-stat"><span>Goal rate</span><strong>{goalRate}%</strong><small>{goalHits} goals reached</small></div>
                <div className="df-fast-stat"><span>Best fast</span><strong>{bestSeconds ? fmtHoursMinutes(bestSeconds) : '—'}</strong><small>longest completed</small></div>
                <div className="df-fast-stat"><span>Total</span><strong>{completedSessions.length}</strong><small>completed sessions</small></div>
              </div>

              <div className="df-fast-window-card">
                <div className="df-fast-window-head"><span className="df-kicker">WINDOW DETAILS</span><strong>{active ? 'Active now' : 'Next fast'}</strong></div>
                {active ? (
                  <>
                    <div className="df-fast-detail-row"><span>Started</span><b>{format(parseISO(active.startedAt), 'MMM d, h:mm a')}</b></div>
                    <div className="df-fast-detail-row"><span>Target</span><b>{active.goalHours}h fast</b></div>
                    <div className="df-fast-detail-row"><span>Break fast at</span><b>{format(new Date(parseISO(active.startedAt).getTime() + active.goalHours * 3600000), 'MMM d, h:mm a')}</b></div>
                    <button className="df-link-btn" onClick={handleEditStart}>Adjust start time →</button>
                  </>
                ) : (
                  <>
                    <div className="df-fast-detail-row"><span>Selected goal</span><b>{goalHours} hours</b></div>
                    <div className="df-fast-detail-row"><span>Suggested finish</span><b>{format(new Date(now.getTime() + goalHours * 3600000), 'MMM d, h:mm a')}</b></div>
                    <p className="df-section-copy" style={{ marginTop: 10 }}>You can adjust the start time after the fast begins.</p>
                  </>
                )}

                {editingStart && active && (
                  <div className="df-fast-edit-box">
                    <label>Start time</label>
                    <input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
                    <div className="df-inline-actions">
                      <button className="df-btn df-btn-primary" onClick={confirmEditStart}>Save</button>
                      <button className="df-btn df-btn-secondary" onClick={() => setEditingStart(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {editingStop && active && (
                  <div className="df-fast-edit-box is-stop">
                    <label>Stop time</label>
                    <input type="datetime-local" value={stopInput} onChange={(e) => setStopInput(e.target.value)} />
                    <div className="df-inline-actions">
                      <button className="df-btn df-btn-primary" onClick={confirmStop}>Confirm end</button>
                      <button className="df-btn df-btn-secondary" onClick={() => setEditingStop(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="df-fast-history-card">
            <div className="df-fast-history-head">
              <div><span className="df-kicker">HISTORY</span><h3>Previous fasting windows</h3></div>
              <span className="df-chip">{completedSessions.length} sessions</span>
            </div>
            {completedSessions.length === 0 ? (
              <div className="df-empty-state" style={{ margin: 16 }}><span style={{ fontSize: 28 }}>◷</span><strong>No completed fasts yet.</strong><p>Your completed windows will build a history here.</p></div>
            ) : (
              <div className="df-fast-history-list">
                {completedSessions.map((session) => {
                  const dur = differenceInSeconds(parseISO(session.endedAt!), parseISO(session.startedAt));
                  const pct = Math.min(100, Math.round((dur / (session.goalHours * 3600)) * 100));
                  return (
                    <div key={session.id} className="df-fast-history-item">
                      <div className={`df-fast-history-score ${pct >= 100 ? 'is-hit' : ''}`}>{pct}%</div>
                      <div className="df-fast-history-main">
                        <strong>{fmtHoursMinutes(dur)}</strong>
                        <span>{format(parseISO(session.startedAt), 'MMM d, h:mm a')} → {format(parseISO(session.endedAt!), 'h:mm a')}</span>
                      </div>
                      <div className="df-fast-history-goal"><span>Goal</span><b>{session.goalHours}h</b></div>
                      <div className="df-mini-progress"><i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--df-green)' : undefined }} /></div>
                      <button className="df-icon-button" onClick={() => deletSession(session.id)} title="Delete session">×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
