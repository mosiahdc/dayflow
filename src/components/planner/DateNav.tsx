import { format, addDays, subDays, isToday } from 'date-fns';
import { useUIStore } from '@/store/uiStore';

export default function DateNav() {
  const { selectedDate, setDate } = useUIStore();
  const date = new Date(selectedDate);

  const btnBase: React.CSSProperties = {
    background: 'var(--df-surface2)',
    border: '1px solid var(--df-border)',
    color: 'var(--df-muted)',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color .15s, color .15s',
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        onClick={() => setDate(format(subDays(date, 1), 'yyyy-MM-dd'))}
        style={{ ...btnBase, width: 36, height: 36, fontSize: 16 }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--df-accent)';
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--df-border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--df-muted)';
        }}
      >
        ←
      </button>

      <button
        onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
        style={{
          ...btnBase,
          height: 36,
          padding: '0 14px',
          fontSize: 12,
          fontWeight: 600,
          background: isToday(date) ? 'var(--df-accent)' : 'var(--df-surface2)',
          borderColor: isToday(date) ? 'var(--df-accent)' : 'var(--df-border)',
          color: isToday(date) ? '#fff' : 'var(--df-muted)',
        }}
      >
        Today
      </button>

      <span
        className="flex-1 text-center text-sm font-semibold truncate"
        style={{ color: 'var(--df-text)' }}
      >
        {format(date, 'EEE, MMM d yyyy')}
      </span>

      <button
        onClick={() => setDate(format(addDays(date, 1), 'yyyy-MM-dd'))}
        style={{ ...btnBase, width: 36, height: 36, fontSize: 16 }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--df-accent)';
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--df-border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--df-muted)';
        }}
      >
        →
      </button>
    </div>
  );
}