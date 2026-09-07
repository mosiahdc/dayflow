import { format, addDays, subDays, isToday } from 'date-fns';
import { useUIStore } from '@/store/uiStore';

export default function DateNav() {
  const { selectedDate, setDate } = useUIStore();
  const date = new Date(selectedDate);

  const iconBtn: React.CSSProperties = {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: '1px solid var(--df-border)',
    background: 'var(--df-surface)',
    color: 'var(--df-text-soft)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 16,
    boxShadow: 'var(--df-shadow-sm)',
    cursor: 'pointer',
  };

  return (
    <div className="df-page-section" style={{ padding: 10 }}>
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => setDate(format(subDays(date, 1), 'yyyy-MM-dd'))}
          style={iconBtn}
          aria-label="Previous day"
        >
          ←
        </button>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div className="df-kicker">DATE</div>
          <div style={{ marginTop: 5, fontSize: 15, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--df-text)' }}>
            {format(date, 'EEEE, MMMM d')}
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: 'var(--df-muted)' }}>
            {format(date, 'yyyy')}
          </div>
        </div>

        <button
          onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
          className="df-pill is-blue"
          style={{ minWidth: 72, justifyContent: 'center', height: 38, boxShadow: 'var(--df-shadow-sm)' }}
        >
          {isToday(date) ? 'Today ✓' : 'Go to today'}
        </button>

        <button
          onClick={() => setDate(format(addDays(date, 1), 'yyyy-MM-dd'))}
          style={iconBtn}
          aria-label="Next day"
        >
          →
        </button>
      </div>
    </div>
  );
}
