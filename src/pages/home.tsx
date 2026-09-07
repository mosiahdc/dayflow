import { useEffect, useMemo } from 'react';
import { format, differenceInHours, parseISO } from 'date-fns';
import { useUIStore } from '@/store/uiStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useFastingStore } from '@/store/fastingStore';
import { useDocumentStore } from '@/store/documentStore';
import { useTradeStore } from '@/store/tradeStore';

const today = () => format(new Date(), 'yyyy-MM-dd');

function MetricCard({ label, value, detail, tone = 'blue', onClick }: {
  label: string;
  value: string;
  detail: string;
  tone?: 'blue' | 'green' | 'amber' | 'violet' | 'rose';
  onClick?: () => void;
}) {
  return (
    <button className={`df-metric df-metric-${tone}`} onClick={onClick} type="button">
      <div className="df-metric-label">{label}</div>
      <div className="df-metric-value">{value}</div>
      <div className="df-metric-detail">{detail}</div>
    </button>
  );
}

export default function HomePage() {
  const setView = useUIStore((s) => s.setView);
  const { scheduledTasks, fetchByDate } = usePlannerStore();
  const { habits, entries, fetchHabits, fetchEntries } = useHabitStore();
  const { active, sessions, fetchSessions } = useFastingStore();
  const { documents, fetchAll } = useDocumentStore();
  const { trades, fetchTrades } = useTradeStore();

  useEffect(() => {
    const d = today();
    fetchByDate(d);
    fetchHabits();
    fetchEntries([d]);
    fetchSessions();
    fetchAll();
    fetchTrades();
  }, [fetchByDate, fetchHabits, fetchEntries, fetchSessions, fetchAll, fetchTrades]);

  const d = today();
  const todayTasks = scheduledTasks.filter((t) => t.date === d);
  const doneTasks = todayTasks.filter((t) => t.done).length;
  const todayEntries = entries.filter((e) => e.date === d && e.completed);
  const habitRate = habits.length ? Math.round((todayEntries.length / habits.length) * 100) : 0;
  const readingNow = documents.filter((doc) => doc.status === 'reading');

  const tradeStats = useMemo(() => {
    const todayTrades = trades.filter((t) => t.closeTime.startsWith(d));
    const pnl = todayTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
    const wins = todayTrades.filter((t) => t.realizedPnl > 0).length;
    return { count: todayTrades.length, pnl, wins };
  }, [trades, d]);

  const fastHours = active
    ? Math.max(0, differenceInHours(new Date(), parseISO(active.startedAt)))
    : sessions[0]?.endedAt
      ? Math.max(0, differenceInHours(parseISO(sessions[0].endedAt), parseISO(sessions[0].startedAt)))
      : 0;

  const activity = [
    ...todayTasks.slice(0, 3).map((t) => ({
      label: t.done ? `Completed ${t.task.title}` : `Planned ${t.task.title}`,
      meta: t.task.category,
      tone: t.done ? 'green' : 'blue',
    })),
    ...trades.slice(0, 2).map((t) => ({
      label: `${t.futures} ${t.direction} closed`,
      meta: `${t.realizedPnl >= 0 ? '+' : ''}${t.realizedPnl.toFixed(2)} USD`,
      tone: t.realizedPnl >= 0 ? 'green' : 'rose',
    })),
  ].slice(0, 5);

  return (
    <div className="df-page df-home-page">
      <section className="df-hero-card">
        <div>
          <span className="df-kicker">TODAY · {format(new Date(), 'EEE, MMM d')}</span>
          <h1>Build a better day, one decision at a time.</h1>
          <p>Plan intentionally, protect your habits, learn consistently, and trade with discipline.</p>
        </div>
        <div className="df-hero-actions">
          <button className="df-btn df-btn-primary" onClick={() => setView('day')}>Open planner</button>
          <button className="df-btn df-btn-secondary" onClick={() => setView('weekly_review')}>Review progress</button>
        </div>
      </section>

      <section className="df-metric-grid">
        <MetricCard label="Today's plan" value={`${doneTasks}/${todayTasks.length || 0}`} detail="tasks completed" tone="blue" onClick={() => setView('day')} />
        <MetricCard label="Habits" value={`${habitRate}%`} detail={`${todayEntries.length} completed today`} tone="green" onClick={() => setView('habits')} />
        <MetricCard label="Fast" value={active ? `${fastHours}h active` : `${fastHours}h`} detail={active ? 'fast in progress' : 'last completed fast'} tone="amber" onClick={() => setView('fasting')} />
        <MetricCard label="Reading" value={`${readingNow.length}`} detail="books currently reading" tone="violet" onClick={() => setView('documents')} />
        <MetricCard label="Trading today" value={`${tradeStats.pnl >= 0 ? '+' : ''}$${tradeStats.pnl.toFixed(2)}`} detail={`${tradeStats.count} trades · ${tradeStats.wins} wins`} tone={tradeStats.pnl >= 0 ? 'green' : 'rose'} onClick={() => setView('trade')} />
      </section>

      <section className="df-home-grid">
        <div className="df-card df-card-lg">
          <div className="df-card-head">
            <div>
              <span className="df-kicker">FOCUS</span>
              <h2>Today's flow</h2>
            </div>
            <button className="df-link-btn" onClick={() => setView('day')}>View planner →</button>
          </div>
          <div className="df-focus-list">
            {todayTasks.length === 0 ? (
              <div className="df-empty-mini">No tasks planned yet. Add your first time block in Planner.</div>
            ) : todayTasks.slice(0, 6).map((t) => (
              <div className="df-focus-row" key={t.id}>
                <span className="df-focus-dot" style={{ background: t.task.color }} />
                <div className="df-focus-copy">
                  <strong className={t.done ? 'line-through opacity-60' : ''}>{t.task.title}</strong>
                  <span>{t.task.durationMins} min · {t.task.category}</span>
                </div>
                <span className={`df-status-pill ${t.done ? 'is-done' : ''}`}>{t.done ? 'Done' : 'Planned'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="df-card">
          <div className="df-card-head">
            <div>
              <span className="df-kicker">MOMENTUM</span>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div className="df-quick-grid">
            <button onClick={() => setView('day')}><span>＋</span><b>Add task</b><small>Plan your next block</small></button>
            <button onClick={() => setView('habits')}><span>✓</span><b>Log habit</b><small>Protect the streak</small></button>
            <button onClick={() => setView('documents')}><span>↗</span><b>Continue reading</b><small>Pick up where you left off</small></button>
            <button onClick={() => setView('trade')}><span>⌁</span><b>Review trades</b><small>Journal the decision</small></button>
          </div>
        </div>

        <div className="df-card df-card-wide">
          <div className="df-card-head">
            <div>
              <span className="df-kicker">RECENT</span>
              <h2>Activity</h2>
            </div>
            <button className="df-link-btn" onClick={() => setView('analytics')}>Open insights →</button>
          </div>
          <div className="df-activity-list">
            {activity.length === 0 ? (
              <div className="df-empty-mini">Your recent activity will appear here.</div>
            ) : activity.map((item, i) => (
              <div className="df-activity-row" key={`${item.label}-${i}`}>
                <span className={`df-activity-icon df-tone-${item.tone}`}>{i + 1}</span>
                <span>{item.label}</span>
                <strong>{item.meta}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
