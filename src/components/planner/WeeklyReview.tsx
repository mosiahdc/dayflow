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
  page: { padding: '16px', maxWidth: 720, margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, flexWrap: 'wrap', gap: 10,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#e8e8f0' },
  weekLabel: { fontSize: 13, color: '#888899', marginTop: 2 },
  navRow: { display: 'flex', gap: 8, alignItems: 'center' },
  navBtn: {
    background: '#1e1e3a', border: '1px solid #2d2d4e',
    borderRadius: 8, padding: '6px 12px', color: '#888899', cursor: 'pointer', fontSize: 13,
  },
  card: {
    background: '#1a1a2e', border: '1px solid #2d2d4e',
    borderRadius: 12, padding: '16px', marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 },
  stat: {
    flex: 1, minWidth: 100,
    background: '#1e1e3a', border: '1px solid #2d2d4e',
    borderRadius: 10, padding: '12px 14px',
  },
  statNum: { fontSize: 24, fontWeight: 700, color: '#4F6EF7' },
  statLabel: { fontSize: 11, color: '#888899', marginTop: 2 },
  label: { fontSize: 12, color: '#888899', fontWeight: 500, marginBottom: 6, display: 'block' },
  input: {
    width: '100%', background: '#12121f', border: '1px solid #2d2d4e',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8e8f0', outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', background: '#12121f', border: '1px solid #2d2d4e',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8e8f0', outline: 'none',
    resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
  },
  priorityRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  priorityNum: {
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff',
  },
  saveBtn: {
    background: '#4F6EF7', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  savedBadge: {
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
    color: '#10B981', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500,
  },
  bookItem: {
    display: 'flex', gap: 10, alignItems: 'center',
    padding: '8px 10px', background: '#1e1e3a', border: '1px solid #2d2d4e',
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

  const priorityColors = ['#4F6EF7', '#10B981', '#F59E0B'];
  const nextWeekLabel = `${format(weekBase, 'MMM d')} – ${format(endOfWeek(weekBase, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;
  const prevLabel = `${format(prevWeekStart, 'MMM d')} – ${format(prevWeekEnd, 'MMM d')}`;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>📋 Weekly Review</div>
          <div style={s.weekLabel}>Planning week of {nextWeekLabel}</div>
        </div>
        <div style={s.navRow}>
          <button style={s.navBtn} onClick={() => setWeekBase(w => subWeeks(w, 1))}>← Prev</button>
          <button
            style={{ ...s.navBtn, color: format(weekBase, 'yyyy-MM-dd') === format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') ? '#2d2d4e' : '#888899', cursor: format(weekBase, 'yyyy-MM-dd') === format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') ? 'default' : 'pointer' }}
            onClick={() => setWeekBase(startOfWeek(today, { weekStartsOn: 1 }))}
          >
            This week
          </button>
          <button
            style={{ ...s.navBtn, color: weekBase > startOfWeek(today, { weekStartsOn: 1 }) ? '#888899' : '#2d2d4e', cursor: weekBase > startOfWeek(today, { weekStartsOn: 1 }) ? 'pointer' : 'default' }}
            onClick={() => { if (weekBase <= startOfWeek(today, { weekStartsOn: 1 })) return; setWeekBase(w => addWeeks(w, 1)); }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── Section 1: Last week recap ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>📊 Last week recap — {prevLabel}</div>

        <div style={s.statRow}>
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: '#4F6EF7' }}>
              {taskStats.pct !== null ? `${taskStats.pct}%` : '—'}
            </div>
            <div style={s.statLabel}>
              Tasks done ({taskStats.done}/{taskStats.total})
            </div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: '#10B981' }}>
              {habitStats.pct !== null ? `${habitStats.pct}%` : '—'}
            </div>
            <div style={s.statLabel}>
              Habits hit ({habitStats.completed}/{habitStats.total})
            </div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: '#F59E0B' }}>{booksLastWeek.length}</div>
            <div style={s.statLabel}>Books finished</div>
          </div>
        </div>

        {booksLastWeek.length > 0 && (
          <div>
            {booksLastWeek.map(b => (
              <div key={b.id} style={s.bookItem}>
                <span style={{ fontSize: 16 }}>📖</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8f0' }}>{b.title}</div>
                  {b.author && <div style={{ fontSize: 11, color: '#888899' }}>{b.author}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Next week intentions ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>🎯 Next week intentions — {nextWeekLabel}</div>

        {/* 3 Priorities */}
        <div style={{ marginBottom: 16 }}>
          <span style={s.label}>Top 3 priorities</span>
          {([0, 1, 2] as const).map(i => (
            <div key={i} style={s.priorityRow}>
              <div style={{ ...s.priorityNum, background: priorityColors[i] }}>{i + 1}</div>
              <input
                style={{ ...s.input }}
                placeholder={i === 0 ? 'Most important priority…' : i === 1 ? 'Second priority…' : 'Third priority…'}
                value={review.priorities[i]}
                onChange={e => {
                  const next = [...review.priorities] as [string, string, string];
                  next[i] = e.target.value;
                  upd('priorities', next);
                }}
              />
            </div>
          ))}
        </div>

        {/* Focus habit */}
        <div style={{ marginBottom: 14 }}>
          <span style={s.label}>Focus habit this week</span>
          <input
            style={s.input}
            placeholder="Which habit to prioritise? e.g. Exercise"
            value={review.focusHabit}
            onChange={e => upd('focusHabit', e.target.value)}
            list="habit-suggestions"
          />
          <datalist id="habit-suggestions">
            {habits.map(h => <option key={h.id} value={h.title} />)}
          </datalist>
        </div>

        {/* Reading goal */}
        <div style={{ marginBottom: 14 }}>
          <span style={s.label}>Reading goal</span>
          <input
            style={s.input}
            placeholder="e.g. Finish Chapter 12 of Atomic Habits"
            value={review.readingGoal}
            onChange={e => upd('readingGoal', e.target.value)}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <span style={s.label}>Other notes / intentions</span>
          <textarea
            style={s.textarea}
            placeholder="Anything else on your mind for the week…"
            value={review.notes}
            onChange={e => upd('notes', e.target.value)}
          />
        </div>

        {/* Save */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Review'}
          </button>
          {saved && <span style={s.savedBadge}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
