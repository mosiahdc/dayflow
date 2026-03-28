/**
 * PublicReadingLog — /reading/:userId
 * No auth required. Reads finished books from Supabase with public read policy.
 * Mount this outside <AuthenticatedApp> in App.tsx based on URL hash.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';

interface PublicBook {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  page_count: number | null;
  started_at: string | null;
  finished_at: string | null;
}

const COLORS = [
  '#4F6EF7',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#7C3AED',
  '#0D9488',
  '#EF4444',
  '#6366F1',
];

function getColor(id: string) {
  return COLORS[id.charCodeAt(0) % COLORS.length] ?? '#4F6EF7';
}

function Cover({ book, size = 72 }: { book: PublicBook; size?: number }) {
  if (book.cover_url) {
    return (
      <img
        src={book.cover_url}
        alt={book.title}
        style={{
          width: size,
          height: size * 1.4,
          objectFit: 'cover',
          borderRadius: 6,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size * 1.4,
        borderRadius: 6,
        background: getColor(book.id),
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.9)',
          textAlign: 'center',
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}
      >
        {book.title}
      </span>
    </div>
  );
}

function fmt(d: string | null) {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

function readDays(started: string | null, finished: string | null) {
  if (!started || !finished) return null;
  try {
    return Math.abs(differenceInDays(parseISO(finished), parseISO(started)));
  } catch {
    return null;
  }
}

export default function PublicReadingLog({ userId }: { userId: string }) {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<'finished' | 'title'>('finished');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('documents')
        .select('id, title, author, cover_url, page_count, started_at, finished_at')
        .eq('user_id', userId)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false });

      if (err) {
        setError('Could not load reading log.');
      } else {
        setBooks((data ?? []) as PublicBook[]);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  const filtered = books
    .filter(
      (b) =>
        !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        (b.author ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const fa = a.finished_at ?? '';
      const fb = b.finished_at ?? '';
      return fb.localeCompare(fa);
    });

  // Stats
  const totalPages = books.reduce((sum, b) => sum + (b.page_count ?? 0), 0);
  const authors = new Set(books.map((b) => b.author).filter(Boolean));
  const thisYear = new Date().getFullYear().toString();
  const booksThisYear = books.filter((b) => (b.finished_at ?? '').startsWith(thisYear)).length;

  function sortBtn(active: boolean): React.CSSProperties {
    return {
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 12,
      cursor: 'pointer',
      fontWeight: 500,
      background: active ? '#4F6EF7' : '#1e1e3a',
      color: active ? '#fff' : '#888899',
      border: `1px solid ${active ? '#4F6EF7' : '#2d2d4e'}`,
    };
  }

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      background: '#12121f',
      color: '#e8e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '0 0 60px',
    },
    header: {
      background: '#1a1a2e',
      borderBottom: '1px solid #2d2d4e',
      padding: '24px 20px 20px',
    },
    logo: {
      fontSize: 13,
      fontWeight: 700,
      color: '#4F6EF7',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    },
    title: { fontSize: 22, fontWeight: 700, color: '#e8e8f0', marginTop: 4 },
    subtitle: { fontSize: 13, color: '#888899', marginTop: 4 },
    statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginTop: 16 },
    stat: {
      background: '#1e1e3a',
      border: '1px solid #2d2d4e',
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 90,
    },
    statNum: { fontSize: 22, fontWeight: 700, color: '#4F6EF7' },
    statLabel: { fontSize: 11, color: '#888899', marginTop: 2 },
    body: { padding: '20px', maxWidth: 680, margin: '0 auto' },
    controls: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const },
    input: {
      flex: 1,
      minWidth: 160,
      background: '#1a1a2e',
      border: '1px solid #2d2d4e',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 13,
      color: '#e8e8f0',
      outline: 'none',
    },

    bookCard: {
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      background: '#1a1a2e',
      border: '1px solid #2d2d4e',
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    bookTitle: { fontSize: 14, fontWeight: 600, color: '#e8e8f0', lineHeight: 1.4 },
    bookAuthor: { fontSize: 12, color: '#888899', marginTop: 3 },
    bookMeta: { display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' as const },
    badge: {
      fontSize: 11,
      color: '#888899',
      background: '#1e1e3a',
      border: '1px solid #2d2d4e',
      borderRadius: 6,
      padding: '2px 8px',
    },
    finishedBadge: {
      fontSize: 11,
      color: '#10B981',
      background: 'rgba(16,185,129,0.1)',
      border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: 6,
      padding: '2px 8px',
    },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={s.logo}>📖 DayFlow</div>
          <div style={s.title}>Reading Log</div>
          <div style={s.subtitle}>
            {loading ? 'Loading…' : `${books.length} book${books.length !== 1 ? 's' : ''} finished`}
          </div>

          {!loading && !error && books.length > 0 && (
            <div style={s.statsRow}>
              <div style={s.stat}>
                <div style={s.statNum}>{books.length}</div>
                <div style={s.statLabel}>Books read</div>
              </div>
              <div style={s.stat}>
                <div style={{ ...s.statNum, color: '#10B981' }}>{booksThisYear}</div>
                <div style={s.statLabel}>This year</div>
              </div>
              <div style={s.stat}>
                <div style={{ ...s.statNum, color: '#F59E0B' }}>
                  {totalPages > 0 ? totalPages.toLocaleString() : '—'}
                </div>
                <div style={s.statLabel}>Pages read</div>
              </div>
              <div style={s.stat}>
                <div style={{ ...s.statNum, color: '#EC4899' }}>{authors.size}</div>
                <div style={s.statLabel}>Authors</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>
        {loading && (
          <p style={{ color: '#888899', textAlign: 'center', paddingTop: 40 }}>Loading…</p>
        )}
        {error && <p style={{ color: '#EF4444', textAlign: 'center', paddingTop: 40 }}>{error}</p>}
        {!loading && !error && books.length === 0 && (
          <p style={{ color: '#888899', textAlign: 'center', paddingTop: 40 }}>
            No finished books yet.
          </p>
        )}

        {!loading && !error && books.length > 0 && (
          <>
            <div style={s.controls}>
              <input
                style={s.input}
                placeholder="Search by title or author…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button style={sortBtn(sort === 'finished')} onClick={() => setSort('finished')}>
                Recently finished
              </button>
              <button style={sortBtn(sort === 'title')} onClick={() => setSort('title')}>
                A–Z
              </button>
            </div>

            {filtered.length === 0 && (
              <p style={{ color: '#888899', textAlign: 'center', padding: '30px 0' }}>
                No results.
              </p>
            )}

            {filtered.map((book, i) => {
              const days = readDays(book.started_at, book.finished_at);
              return (
                <div
                  key={book.id}
                  style={{
                    ...s.bookCard,
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <Cover book={book} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.bookTitle}>{book.title}</div>
                    {book.author && <div style={s.bookAuthor}>{book.author}</div>}
                    <div style={s.bookMeta}>
                      {book.finished_at && (
                        <span style={s.finishedBadge}>✓ {fmt(book.finished_at)}</span>
                      )}
                      {book.started_at && (
                        <span style={s.badge}>Started {fmt(book.started_at)}</span>
                      )}
                      {days !== null && (
                        <span style={s.badge}>
                          {days === 0 ? 'Same day' : `${days}d to finish`}
                        </span>
                      )}
                      {book.page_count && (
                        <span style={s.badge}>{book.page_count.toLocaleString()} pages</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#2d2d4e' }}>
          Powered by DayFlow
        </div>
      </div>
    </div>
  );
}
