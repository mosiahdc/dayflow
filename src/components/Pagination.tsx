interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export default function Pagination({ page, totalPages, total, pageSize, onPage }: Props) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const buttonStyle = (active = false, disabled = false): React.CSSProperties => ({
    minWidth: 34,
    height: 34,
    padding: '0 12px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: active ? 800 : 700,
    cursor: disabled ? 'default' : 'pointer',
    border: `1px solid ${active ? 'transparent' : 'var(--df-border)'}`,
    background: active ? 'linear-gradient(90deg, var(--df-accent), var(--df-accent2))' : 'var(--df-surface)',
    color: active ? '#fff' : disabled ? 'var(--df-muted)' : 'var(--df-text)',
    boxShadow: active ? '0 10px 20px rgba(37, 99, 235, .18)' : 'none',
    opacity: disabled ? 0.45 : 1,
  });

  const btn = (label: string, target: number, disabled: boolean) => (
    <button key={label} onClick={() => !disabled && onPage(target)} disabled={disabled} style={buttonStyle(false, disabled)}>
      {label}
    </button>
  );

  const pages: number[] = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i);

  return (
    <div className="df-page-section" style={{ padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div className="df-kicker">PAGINATION</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--df-text)' }}>
            Showing <strong>{start}–{end}</strong> of <strong>{total}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {btn('‹‹', 1, page === 1)}
          {btn('‹', page - 1, page === 1)}
          {pages.map((p) => (
            <button key={p} onClick={() => onPage(p)} style={buttonStyle(p === page)}>
              {p}
            </button>
          ))}
          {btn('›', page + 1, page === totalPages)}
          {btn('››', totalPages, page === totalPages)}
        </div>
      </div>
    </div>
  );
}
