/**
 * WeeklyReview — structured weekly planning session
 * Two sections:
 *   1. Last week recap — tasks %, habits %, books read
 *   2. Next week intentions — 3 priorities, focus habit, reading goal
 * Stored in Supabase `weekly_reviews` table.
 *
 * SQL to run in Supabase:
 * CREATE TABLE weekly_reviews (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id uuid REFERENCES auth.users NOT NULL,
 *   week_start date NOT NULL,
 *   priorities text[] DEFAULT '{}',
 *   focus_habit text,
 *   reading_goal text,
 *   notes text,
 *   created_at timestamptz DEFAULT now(),
 *   updated_at timestamptz DEFAULT now(),
 *   UNIQUE(user_id, week_start)
 * );
 * ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own" ON weekly_reviews FOR ALL USING (auth.uid() = user_id);
 */
import { useEffect, useState, useMemo } from 'react';
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  parseISO, eachDayOfInterval,
} from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useHabitStore } from '@/store/habitStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useDocumentStore } from '@/store/documentStore';

interface WeeklyReview {
  id?: string;
  weekStart: string;
  priorities: [string, string, string];
  focusHabit: string;
  readingGoal: string;
  notes: string;
}

const blank = (weekStart: string): WeeklyReview => ({
  weekStart,
  priorities: ['', '', ''],
  focusHabit: '',
  readingGoal: '',
  notes: '',
});

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const s: Record<string, React.CSSProperties> = {
  page: { padding: '0', maxWidth: 940, margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, flexWrap: 'wrap', gap: 10,
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--df-text)' },
  weekLabel: { fontSize: 13, color: 'var(--df-muted)', marginTop: 2 },
  navRow: { display: 'flex', gap: 8, alignItems: 'center' },
  navBtn: {
    background: 'var(--df-surface2)', border: '1px solid var(--df-border)',
    borderRadius: 8, padding: '6px 12px', color: 'var(--df-muted)', cursor: 'pointer', fontSize: 13,
  },
  card: {
    background: 'var(--df-surface)', border: '1px solid var(--df-border)',
    borderRadius: 12, padding: '16px', marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--df-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 },
  stat: {
    flex: 1, minWidth: 100,
    background: 'var(--df-surface2)', border: '1px solid var(--df-border)',
    borderRadius: 10, padding: '12px 14px',
  },
  statNum: { fontSize: 24, fontWeight: 700, color: 'var(--df-accent)' },
  statLabel: { fontSize: 11, color: 'var(--df-muted)', marginTop: 2 },
  label: { fontSize: 12, color: 'var(--df-muted)', fontWeight: 500, marginBottom: 6, display: 'block' },
  input: {
    width: '100%', background: 'var(--df-bg-soft)', border: '1px solid var(--df-border)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--df-text)', outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', background: 'var(--df-bg-soft)', border: '1px solid var(--df-border)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--df-text)', outline: 'none',
    resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
  },
  priorityRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  priorityNum: {
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff',
  },
  saveBtn: {
    background: 'var(--df-accent)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  savedBadge: {
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
    color: 'var(--df-green)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500,
  },
  bookItem: {
    display: 'flex', gap: 10, alignItems: 'center',
    padding: '8px 10px', background: 'var(--df-surface2)', border: '1px solid var(--df-border)',
    borderRadius: 8, marginBottom: 6,
  },
};

export default function WeeklyReview() {
  const today = new Date();
  const [weekBase, setWeekBase] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [review, setReview] = useState<WeeklyReview>(blank(format(weekBase, 'yyyy-MM-dd')));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { habits, entries: allEntries, weekEntries, fetchHabits, fetchAllEntries, fetchEntries } = useHabitStore();
  const { scheduledTasks, fetchByWeek } = usePlannerStore();
  const { documents, fetchAll } = useDocumentStore();

  const prevWeekStart = subWeeks(weekBase, 1);
  const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
  const weekStartStr = format(weekBase, 'yyyy-MM-dd');

  // Load data
  useEffect(() => { fetchHabits(); fetchAllEntries(); fetchAll(); }, []);

  useEffect(() => {
    const start = format(prevWeekStart, 'yyyy-MM-dd');
    const end = format(prevWeekEnd, 'yyyy-MM-dd');
    fetchByWeek(start, end);
    const days = eachDayOfInterval({ start: prevWeekStart, end: prevWeekEnd }).map(d => format(d, 'yyyy-MM-dd'));
    fetchEntries(days);
  }, [weekBase]);

  // Load saved review for this week
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('weekly_reviews')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .single();
      if (data) {
        setReview({
          id: data.id,
          weekStart: data.week_start,
          priorities: (data.priorities?.length === 3 ? data.priorities : ['', '', '']) as [string, string, string],
          focusHabit: data.focus_habit ?? '',
          readingGoal: data.reading_goal ?? '',
          notes: data.notes ?? '',
        });
      } else {
        setReview(blank(weekStartStr));
      }
      setSaved(false);
    }
    load();
  }, [weekStartStr]);

  // ── Last week stats ────────────────────────────────────────────────────
  const lastWeekDates = eachDayOfInterval({ start: prevWeekStart, end: prevWeekEnd })
    .map(d => format(d, 'yyyy-MM-dd'));

  const habitStats = useMemo(() => {
    let total = 0, completed = 0;
    lastWeekDates.forEach(date => {
      const dow = DAY_KEYS[parseISO(date).getDay()];
      habits.forEach(h => {
        if (!h.targetDays.includes(dow as any)) return;
        total++;
        if (allEntries.some(e => e.habitId === h.id && e.date === date && e.completed)) completed++;
      });
    });
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : null };
  }, [habits, allEntries, weekBase]);

  const taskStats = useMemo(() => {
    const weekTasks = scheduledTasks.filter(t => {
      if (!t.date) return false;
      return lastWeekDates.includes(t.date);
    });
    const done = weekTasks.filter(t => t.done).length;
    return { total: weekTasks.length, done, pct: weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : null };
  }, [scheduledTasks, weekBase]);

  const booksLastWeek = useMemo(() =>
    documents.filter(d => d.status === 'finished' && d.finishedAt && lastWeekDates.includes(d.finishedAt.slice(0, 10))),
    [documents, weekBase]
  );

  // ── Save ──────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      user_id: user.id,
      week_start: weekStartStr,
      priorities: review.priorities,
      focus_habit: review.focusHabit || null,
      reading_goal: review.readingGoal || null,
      notes: review.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('weekly_reviews')
      .upsert(payload, { onConflict: 'user_id,week_start' })
      .select()
      .single();

    if (!error && data) {
      setReview(r => ({ ...r, id: data.id }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  function upd(field: keyof WeeklyReview, val: unknown) {
    setSaved(false);
    setReview(r => ({ ...r, [field]: val }));
  }

  const priorityColors = ['var(--df-accent)', 'var(--df-green)', 'var(--df-amber)'];
  const nextWeekLabel = `${format(weekBase, 'MMM d')} – ${format(endOfWeek(weekBase, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;
  const prevLabel = `${format(prevWeekStart, 'MMM d')} – ${format(prevWeekEnd, 'MMM d')}`;

  const recapMetrics = [taskStats.pct, habitStats.pct].filter((v): v is number => v !== null);
  const recapScore = recapMetrics.length ? Math.round(recapMetrics.reduce((a, b) => a + b, 0) / recapMetrics.length) : null;
  const filledPriorities = review.priorities.filter((p) => p.trim()).length;

  return (
    <div style={s.page} className="df-review-shell df-review-workspace">
      <section className="df-review-hero">
        <div>
          <span className="df-kicker">WEEKLY RESET</span>
          <h2>Close the loop before you plan the next one.</h2>
          <p>Review what actually happened, keep the useful lessons, then choose a small number of priorities for {nextWeekLabel}.</p>
        </div>
        <div className="df-review-nav">
          <button onClick={() => setWeekBase((w) => subWeeks(w, 1))}>←</button>
          <div><span>Planning week</span><strong>{nextWeekLabel}</strong></div>
          <button onClick={() => { if (weekBase <= startOfWeek(today, { weekStartsOn: 1 })) return; setWeekBase((w) => addWeeks(w, 1)); }}>→</button>
          <button className="df-review-current" onClick={() => setWeekBase(startOfWeek(today, { weekStartsOn: 1 }))}>This week</button>
        </div>
      </section>

      <section className="df-review-score-grid">
        <div className="df-review-score-card is-overall">
          <span>Completion snapshot</span>
          <strong>{recapScore !== null ? `${recapScore}%` : '—'}</strong>
          <small>average of task + habit completion</small>
        </div>
        <div className="df-review-score-card">
          <span>Tasks</span>
          <strong>{taskStats.pct !== null ? `${taskStats.pct}%` : '—'}</strong>
          <small>{taskStats.done}/{taskStats.total} completed</small>
        </div>
        <div className="df-review-score-card">
          <span>Habits</span>
          <strong>{habitStats.pct !== null ? `${habitStats.pct}%` : '—'}</strong>
          <small>{habitStats.completed}/{habitStats.total} target checks</small>
        </div>
        <div className="df-review-score-card">
          <span>Reading</span>
          <strong>{booksLastWeek.length}</strong>
          <small>books finished last week</small>
        </div>
      </section>

      <div className="df-review-layout">
        <section className="df-review-card df-review-recap-card">
          <div className="df-review-card-head">
            <div><span className="df-kicker">01 · LOOK BACK</span><h3>Last week · {prevLabel}</h3></div>
            <span className="df-chip is-blue">Evidence first</span>
          </div>
          <p className="df-section-copy">Use the data as context, not as a grade. The goal is to understand where your system supported you and where it created friction.</p>

          <div className="df-review-insight-row">
            <div><span>Task execution</span><b>{taskStats.pct !== null ? `${taskStats.pct}%` : 'No data'}</b></div>
            <div className="df-mini-progress"><i style={{ width: `${taskStats.pct ?? 0}%` }} /></div>
          </div>
          <div className="df-review-insight-row">
            <div><span>Habit consistency</span><b>{habitStats.pct !== null ? `${habitStats.pct}%` : 'No data'}</b></div>
            <div className="df-mini-progress"><i style={{ width: `${habitStats.pct ?? 0}%`, background: 'var(--df-green)' }} /></div>
          </div>

          {booksLastWeek.length > 0 ? (
            <div className="df-review-books">
              <span className="df-field-label">Finished reading</span>
              {booksLastWeek.map((b) => (
                <div key={b.id} className="df-review-book-row">
                  <span>📖</span>
                  <div><strong>{b.title}</strong>{b.author && <small>{b.author}</small>}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="df-review-note"><span>Reading</span><p>No books were marked finished during the reviewed week.</p></div>
          )}

          <div className="df-field" style={{ marginTop: 18 }}>
            <label>Lessons / other notes</label>
            <textarea
              placeholder="What worked? What felt heavier than it should? What should change next week?"
              value={review.notes}
              onChange={(e) => upd('notes', e.target.value)}
            />
          </div>
        </section>

        <section className="df-review-card df-review-plan-card">
          <div className="df-review-card-head">
            <div><span className="df-kicker">02 · LOOK FORWARD</span><h3>Design the next week</h3></div>
            <span className={`df-chip ${filledPriorities === 3 ? 'is-green' : ''}`}>{filledPriorities}/3 priorities</span>
          </div>
          <p className="df-section-copy">Three priorities is a constraint on purpose. If everything is important, the week has no direction.</p>

          <div className="df-review-priorities">
            {([0, 1, 2] as const).map((i) => (
              <label key={i} className="df-review-priority-row">
                <span style={{ background: priorityColors[i] }}>{i + 1}</span>
                <input
                  placeholder={i === 0 ? 'The one outcome that matters most…' : i === 1 ? 'Second important outcome…' : 'Third important outcome…'}
                  value={review.priorities[i]}
                  onChange={(e) => {
                    const next = [...review.priorities] as [string, string, string];
                    next[i] = e.target.value;
                    upd('priorities', next);
                  }}
                />
              </label>
            ))}
          </div>

          <div className="df-review-focus-grid">
            <div className="df-field">
              <label>Focus habit</label>
              <input
                placeholder="e.g. Exercise"
                value={review.focusHabit}
                onChange={(e) => upd('focusHabit', e.target.value)}
                list="habit-suggestions"
              />
              <datalist id="habit-suggestions">{habits.map((h) => <option key={h.id} value={h.title} />)}</datalist>
            </div>
            <div className="df-field">
              <label>Reading goal</label>
              <input
                placeholder="e.g. Finish Chapter 12"
                value={review.readingGoal}
                onChange={(e) => upd('readingGoal', e.target.value)}
              />
            </div>
          </div>

          <div className="df-review-save-bar">
            <div><span>Ready for the week?</span><small>Your review can be edited again later.</small></div>
            <button className="df-btn df-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Complete review'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
