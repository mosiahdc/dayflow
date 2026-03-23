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

  const btn = (label: string, target: number, disabled: boolean) => (
    <button
      key={label}
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      style={{
        padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid var(--df-border)', background: 'transparent',
        color: disabled ? 'var(--df-muted)' : 'var(--df-text)', opacity: disabled ? 0.4 : 1,
      }}
    >{label}</button>
  );

  // Page number buttons — show up to 5 around current
  const pages: number[] = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, padding: '12px 0', fontSize: 12, color: 'var(--df-muted)', flexWrap: 'wrap' }}>
      <span>{start}–{end} of {total}</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {btn('‹‹', 1, page === 1)}
        {btn('‹', page - 1, page === 1)}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            style={{
              padding: '4px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--df-border)',
              background: p === page ? 'var(--df-accent)' : 'transparent',
              color: p === page ? '#fff' : 'var(--df-text)',
              fontWeight: p === page ? 600 : 400,
            }}
          >{p}</button>
        ))}
        {btn('›', page + 1, page === totalPages)}
        {btn('››', totalPages, page === totalPages)}
      </div>
    </div>
  );
}
