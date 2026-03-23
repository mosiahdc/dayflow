import { useEffect, useState } from 'react';
import { useHighlightStore, HIGHLIGHT_COLORS } from '@/store/highlightStore';
import type { Highlight } from '@/store/highlightStore';
import { useUIStore } from '@/store/uiStore';
import { format, parseISO } from 'date-fns';

function fmt(dateStr: string) {
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return dateStr; }
}

function HighlightCard({ highlight, onUpdateNote, onDelete, onOpen }: {
  highlight: Highlight;
  onUpdateNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(highlight.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveNote = () => {
    onUpdateNote(highlight.id, note);
    setEditing(false);
  };

  const isPageNote = highlight.text === '__page_note__';

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      {/* Colour stripe + text */}
      <div className="flex gap-0" >
        <div className="w-1 shrink-0 rounded-l-xl" style={{ background: highlight.color }} />
        <div className="flex-1 px-3 pt-3 pb-2">
          {isPageNote ? (
            // Page note — show the note as the main content
            <p className="text-sm leading-relaxed text-white">
              {highlight.note}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-white" style={{ fontFamily: 'Georgia, serif' }}>
              "{highlight.text}"
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {isPageNote && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>📝 note</span>
            )}
            <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
              {highlight.page != null ? `p.${highlight.page}` : highlight.spineIndex != null ? `ch.${highlight.spineIndex + 1}` : ''}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>· {fmt(highlight.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Note area — only for highlights (not page notes, which are already shown above) */}
      {!isPageNote && (highlight.note || editing) && (
        <div className="px-3 pb-2 pt-1" style={{ borderTop: '1px solid var(--df-border)' }}>
          {editing ? (
            <>
              <textarea
                autoFocus
                rows={3}
                className="w-full rounded-lg px-2 py-1.5 text-xs text-white outline-none resize-none mb-2"
                style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setNote(highlight.note ?? ''); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveNote}
                  className="text-xs px-2 py-1 rounded text-white font-medium"
                  style={{ background: 'var(--df-accent)', border: 'none', cursor: 'pointer' }}>
                  Save note
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--df-muted)' }}>
              📝 {highlight.note}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-1.5" style={{ borderTop: '1px solid var(--df-border)' }}>
        {/* Open in document */}
        <button
          onClick={onOpen}
          className="text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1 font-medium"
          style={{ background: 'var(--df-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          📄 Open
          {highlight.page != null
            ? ` p.${highlight.page}`
            : highlight.spineIndex != null
              ? ` ch.${highlight.spineIndex + 1}`
              : ''}
        </button>

        <div className="flex-1" />

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] px-2 py-1 rounded transition-colors"
            style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)', cursor: 'pointer' }}
          >
            {highlight.note ? '✏️ Edit note' : '+ Add note'}
          </button>
        )}
        {confirmDelete ? (
          <>
            <button onClick={() => onDelete(highlight.id)}
              className="text-[10px] px-2 py-1 rounded text-white font-medium"
              style={{ background: '#ef4444', border: 'none', cursor: 'pointer' }}>
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-[10px] px-2 py-1 rounded"
              style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)', cursor: 'pointer' }}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="text-[10px] px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--df-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotebookPage() {
  const { highlights, loading, fetchAll, updateNote, deleteHighlight } = useHighlightStore();
  const { setView, openDocAt } = useUIStore();

  const [search, setSearch] = useState('');
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterDoc, setFilterDoc] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Group by document
  const filtered = highlights.filter((h) => {
    // Include page notes (__page_note__) — they have content in h.note
    // Only skip if it's a page note with no actual note content
    if (h.text === '__page_note__' && !h.note) return false;
    const searchText = h.text === '__page_note__' ? (h.note ?? '') : h.text;
    const matchSearch = !search || searchText.toLowerCase().includes(search.toLowerCase()) ||
      (h.note ?? '').toLowerCase().includes(search.toLowerCase());
    const matchColor = !filterColor || h.color === filterColor;
    const matchDoc = !filterDoc || h.documentId === filterDoc;
    return matchSearch && matchColor && matchDoc;
  });

  const docs = Array.from(
    new Map(highlights.map((h) => [h.documentId, h.documentTitle])).entries()
  );

  const grouped = filtered.reduce<Record<string, { title: string; items: Highlight[] }>>((acc, h) => {
    if (!acc[h.documentId]) acc[h.documentId] = { title: h.documentTitle, items: [] };
    acc[h.documentId].items.push(h);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-white">📓 Notebook</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--df-muted)' }}>
            {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} across {docs.length} document{docs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setView('documents')}
          className="text-xs px-3 py-1.5 rounded-md transition-colors"
          style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)', cursor: 'pointer' }}
        >
          ← Documents
        </button>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-3 mb-4 flex flex-col gap-2"
        style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
      >
        {/* Search */}
        <input
          className="w-full rounded-lg px-3 py-1.5 text-sm text-white outline-none"
          style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
          placeholder="Search highlights and notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-3 flex-wrap">
          {/* Colour filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>Colour</span>
            <button
              onClick={() => setFilterColor(null)}
              className="text-[10px] px-2 py-0.5 rounded-full transition-all"
              style={{
                background: !filterColor ? 'var(--df-accent)' : 'var(--df-surface2)',
                color: !filterColor ? '#fff' : 'var(--df-muted)',
                border: '1px solid var(--df-border)', cursor: 'pointer',
              }}
            >All</button>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilterColor(filterColor === c.value ? null : c.value)}
                className="w-5 h-5 rounded-full transition-transform"
                style={{
                  background: c.value,
                  transform: filterColor === c.value ? 'scale(1.3)' : 'scale(1)',
                  outline: filterColor === c.value ? `2px solid ${c.value}` : 'none',
                  outlineOffset: 2, border: 'none', cursor: 'pointer',
                }}
                title={c.label}
              />
            ))}
          </div>

          {/* Document filter */}
          {docs.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>Doc</span>
              <button
                onClick={() => setFilterDoc(null)}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: !filterDoc ? 'var(--df-accent)' : 'var(--df-surface2)',
                  color: !filterDoc ? '#fff' : 'var(--df-muted)',
                  border: '1px solid var(--df-border)', cursor: 'pointer',
                }}
              >All</button>
              {docs.map(([id, title]) => (
                <button
                  key={id}
                  onClick={() => setFilterDoc(filterDoc === id ? null : id)}
                  className="text-[10px] px-2 py-0.5 rounded-full truncate max-w-[120px]"
                  style={{
                    background: filterDoc === id ? 'var(--df-accent)' : 'var(--df-surface2)',
                    color: filterDoc === id ? '#fff' : 'var(--df-muted)',
                    border: '1px solid var(--df-border)', cursor: 'pointer',
                  }}
                  title={title}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <p className="text-sm animate-pulse" style={{ color: 'var(--df-muted)' }}>Loading…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && highlights.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📓</p>
          <p className="text-sm font-semibold text-white mb-1">No highlights yet</p>
          <p className="text-xs" style={{ color: 'var(--df-muted)' }}>
            Select text in any PDF or EPUB to save a highlight here
          </p>
          <button
            onClick={() => setView('documents')}
            className="mt-4 text-xs px-4 py-2 rounded-md text-white font-medium"
            style={{ background: 'var(--df-accent)', border: 'none', cursor: 'pointer' }}
          >
            Open Documents
          </button>
        </div>
      )}

      {/* No results */}
      {!loading && highlights.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--df-muted)' }}>No highlights match your filters.</p>
        </div>
      )}

      {/* Grouped highlights */}
      {Object.entries(grouped).map(([docId, { title, items }]) => (
        <div key={docId} className="mb-6">
          {/* Document header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: 'var(--df-border)' }} />
            <button
              onClick={() => setFilterDoc(filterDoc === docId ? null : docId)}
              className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{ color: 'var(--df-text)', background: 'var(--df-surface2)', border: '1px solid var(--df-border)', cursor: 'pointer' }}
            >
              📄 {title} · {items.length}
            </button>
            <div className="h-px flex-1" style={{ background: 'var(--df-border)' }} />
          </div>

          {items.map((h) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              onUpdateNote={updateNote}
              onDelete={deleteHighlight}
              onOpen={() => openDocAt(h.documentId, h.page, h.spineIndex)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
