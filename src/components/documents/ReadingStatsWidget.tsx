import React, { useEffect, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useReadingGoalStore } from '@/store/readingGoalStore';
import { useUIStore } from '@/store/uiStore';
import { startOfWeek } from 'date-fns';

export default function ReadingStatsWidget() {
  const { documents, fetchAll, fetchPagesThisWeek } = useDocumentStore();
  const { goal, fetchGoal } = useReadingGoalStore();
  const { setView } = useUIStore();
  const [pagesThisWeek, setPagesThisWeek] = useState(0);

  useEffect(() => {
    if (documents.length === 0) fetchAll();
    fetchGoal(new Date().getFullYear());
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const ws = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
    fetchPagesThisWeek(ws).then(setPagesThisWeek);
  }, [fetchAll, fetchGoal, fetchPagesThisWeek]);

  const queue    = documents.filter(d => d.status === 'queue').length;
  const reading  = documents.filter(d => d.status === 'reading').length;
  const finished = documents.filter(d => d.status === 'finished').length;
  const goalNum  = goal?.goal ?? 12;
  const pct      = Math.min(100, Math.round((finished / goalNum) * 100));

  const inProgress = documents.filter(d => d.status === 'reading');

  const s: Record<string, React.CSSProperties> = {
    card: {
      background: 'var(--df-surface)', border: '1px solid var(--df-border)',
      borderRadius: 12, overflow: 'hidden', fontSize: 13,
    },
    header: {
      padding: '8px 12px', borderBottom: '1px solid var(--df-border)',
      fontSize: 12, fontWeight: 600, color: 'var(--df-text)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    viewAll: {
      fontSize: 11, color: 'var(--df-accent)', background: 'none',
      border: 'none', cursor: 'pointer', padding: 0,
    },
    section: { padding: '10px 12px', borderBottom: '1px solid var(--df-border)' },
    sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--df-muted)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    shelfRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', fontSize: 13, color: 'var(--df-text)',
    },
    badge: {
      background: 'var(--df-accent)', color: '#fff', borderRadius: 999,
      fontSize: 11, fontWeight: 600, minWidth: 20, height: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
    },
    goalNum: { fontSize: 36, fontWeight: 700, color: 'var(--df-text)', lineHeight: 1 },
    goalSub: { fontSize: 12, color: 'var(--df-muted)', marginTop: 4 },
    bar: { height: 6, borderRadius: 3, background: 'var(--df-border)', margin: '8px 0 4px', overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3, background: 'var(--df-accent)', transition: 'width 0.4s ease' },
    pctLabel: { fontSize: 12, color: 'var(--df-accent)', fontWeight: 500 },
    progressRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', fontSize: 13, color: 'var(--df-text)',
      borderBottom: '1px solid var(--df-border)',
    },
    pagesLeft: { fontSize: 12, color: 'var(--df-muted)' },
  };

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <span>📖 Reading</span>
        <button style={s.viewAll} onClick={() => setView('documents')}>View all →</button>
      </div>

      {/* Shelves */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Shelves</div>
        {([['Queue', queue], ['Reading', reading], ['Archive', finished]] as [string, number][]).map(([label, count]) => (
          <div key={label} style={s.shelfRow}>
            <span>{label}</span>
            <span style={s.badge}>{count}</span>
          </div>
        ))}
      </div>

      {/* Goals */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Goals</div>
        <div style={{ textAlign: 'center' }}>
          <div style={s.goalNum}>
            <span style={{ color: 'var(--df-accent)' }}>{finished}</span>
            <span style={{ color: 'var(--df-muted)', fontWeight: 400, fontSize: 28 }}> / {goalNum}</span>
          </div>
          <div style={s.goalSub}>Books Completed</div>
          <div style={s.bar}>
            <div style={{ ...s.barFill, width: `${pct}%` }} />
          </div>
          <div style={s.pctLabel}>{pct}%</div>
        </div>
      </div>

      {/* Progress */}
      {inProgress.length > 0 && (
        <div style={{ padding: '10px 12px' }}>
          <div style={s.sectionTitle}>Progress</div>
          {inProgress.map(doc => {
            const left = doc.pageCount ? doc.pageCount - (doc.lastPage ?? 0) : null;
            return (
              <div key={doc.id} style={s.progressRow}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                  {doc.title}
                </span>
                <span style={s.pagesLeft}>
                  {left !== null ? `${left} pages left` : `p.${doc.lastPage ?? 0}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
