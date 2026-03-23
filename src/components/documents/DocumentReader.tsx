import React, { useState, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDocumentStore } from '@/store/documentStore';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useHighlightStore } from '@/store/highlightStore';
import { HIGHLIGHT_COLORS } from '@/store/highlightStore';
import { pdfjs } from 'react-pdf';
import type { Document } from '@/types';
import type { DocBookmark } from '@/store/bookmarkStore';
import type { Highlight } from '@/store/highlightStore';

const PdfReader = lazy(() => import('./PdfReader'));
const EpubReader = lazy(() => import('./EpubReader'));

interface Chapter { title: string; page?: number; href?: string; }

interface Props {
  doc: Document;
  onClose: () => void;
  initialPage?: number | null;
  initialSpineIndex?: number | null;
}

// ── Sidebar tab type ──────────────────────────────────────────────────────────
type SidebarTab = 'toc' | 'highlights' | 'search';

// ── Search result ─────────────────────────────────────────────────────────────
interface SearchResult { page: number; snippet: string; matchIndex: number; }

// ── Sidebar ───────────────────────────────────────────────────────────────────
function ReaderSidebar({
  doc, currentPage, totalPages, outline, bookmarks, highlights,
  pdfUrl, epubIframeRef, fileType,
  onJumpPage, onJumpHref, onJumpCfi, onDeleteBookmark, onUpdateHighlightNote,
  onDeleteHighlight, onClose, initialTab, onSearchPhraseChange,
}: {
  doc: Document;
  currentPage: number; totalPages: number;
  outline: Chapter[];
  bookmarks: DocBookmark[];
  highlights: Highlight[];
  pdfUrl: string | null;
  epubIframeRef: React.RefObject<HTMLIFrameElement | null>;
  fileType: 'pdf' | 'epub';
  onJumpPage: (p: number) => void;
  onJumpHref: (href: string) => void;
  onJumpCfi: (cfi: string) => void;
  onDeleteBookmark: (id: string) => void;
  onUpdateHighlightNote: (id: string, note: string) => void;
  onDeleteHighlight: (id: string) => void;
  onClose: () => void;
  initialTab?: SidebarTab | undefined;
  onSearchPhraseChange?: ((phrase: string) => void) | undefined;
}) {
  const [tab, setTab] = useState<SidebarTab>(initialTab ?? 'toc');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchIdx, setSearchIdx] = useState(0);
  const [epubMatchCount, setEpubMatchCount] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
    if (initialTab !== 'search') onSearchPhraseChange?.('');
  }, [initialTab]);
  useEffect(() => { if (tab === 'search') setTimeout(() => searchInputRef.current?.focus(), 50); }, [tab]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'epub-search-result') {
        setEpubMatchCount(e.data.count as number);
        setSearching(false); setSearched(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    if (fileType === 'pdf') {
      if (!pdfUrl) return;
      setSearching(true); setSearchResults([]); setSearched(false); setSearchIdx(0);
      try {
        const pdf = await pdfjs.getDocument(pdfUrl).promise;
        const found: SearchResult[] = [];
        const needle = searchQuery.toLowerCase();
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          const text = tc.items.map((item: any) => item.str ?? '').join(' ');
          const lower = text.toLowerCase();
          let idx = 0;
          while ((idx = lower.indexOf(needle, idx)) !== -1) {
            const s = Math.max(0, idx - 55), e2 = Math.min(text.length, idx + needle.length + 55);
            found.push({ page: i, snippet: (s > 0 ? '…' : '') + text.slice(s, e2) + (e2 < text.length ? '…' : ''), matchIndex: found.length });
            idx += needle.length;
            if (found.length >= 200) break;
          }
          if (found.length >= 200) break;
        }
        setSearchResults(found); setSearchIdx(0);
        if (found.length > 0) onJumpPage(found[0]!.page);
      } catch (e) { console.warn('Search failed:', e); }
      finally { setSearching(false); setSearched(true); }
    } else {
      setSearching(true); setEpubMatchCount(null); setSearched(false);
      epubIframeRef.current?.contentWindow?.postMessage({ type: 'search', query: searchQuery }, '*');
    }
  };

  const goToResult = (idx: number) => {
    const c = Math.max(0, Math.min(idx, searchResults.length - 1));
    setSearchIdx(c);
    onJumpPage(searchResults[c]?.page ?? 1);
    onSearchPhraseChange?.(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery(''); setSearchResults([]); setSearched(false); setSearchIdx(0); setEpubMatchCount(null);
    onSearchPhraseChange?.('');
    if (fileType === 'epub') epubIframeRef.current?.contentWindow?.postMessage({ type: 'search', query: '' }, '*');
  };

  const highlightSnippet = (snippet: string) => {
    const q = searchQuery.toLowerCase();
    const lower = snippet.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return <>{snippet}</>;
    return (<>{snippet.slice(0, idx)}<mark style={{ background: 'rgba(79,110,247,0.35)', color: 'inherit', borderRadius: 2, padding: 0 }}>{snippet.slice(idx, idx + searchQuery.length)}</mark>{snippet.slice(idx + searchQuery.length)}</>);
  };

  const chapters: Chapter[] = outline.length > 0
    ? outline
    : totalPages > 0
      ? Array.from({ length: Math.min(8, totalPages) }, (_, i) => ({
          title: `Section ${i + 1}`,
          page: Math.min(Math.round((i / Math.min(8, totalPages)) * totalPages) + 1, totalPages),
        }))
      : [];

  const docHighlights = highlights.filter(h => h.documentId === doc.id);

  const tabBtn = (t: SidebarTab, label: string) => (
    <button
      onClick={() => { setTab(t); if (t !== 'search') { clearSearch(); } }}
      className="flex-1 text-[10px] py-1.5 font-medium transition-colors"
      style={{
        background: tab === t ? 'var(--df-accent)' : 'transparent',
        color: tab === t ? '#fff' : 'var(--df-muted)',
        border: 'none', cursor: 'pointer', borderRadius: 4,
      }}
    >{label}</button>
  );

  return (
    <div className="flex flex-col shrink-0 h-full"
      style={{ width: 220, background: 'var(--df-surface2)', borderRight: '1px solid var(--df-border)' }}>

      {/* Header with back button + tab switcher */}
      <div className="flex items-center gap-2 px-2 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--df-border)' }}>
        <button onClick={onClose}
          className="flex items-center justify-center rounded text-white shrink-0"
          style={{ background: 'var(--df-border)', width: 26, height: 26, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          ‹
        </button>
        <div className="flex flex-1 gap-1 p-0.5 rounded"
          style={{ background: 'var(--df-border)' }}>
          {tabBtn('toc', 'Contents')}
          {tabBtn('highlights', `Notes ${docHighlights.length > 0 ? `(${docHighlights.length})` : ''}`)}
          {tabBtn('search', '🔍')}
        </div>
      </div>

      {/* ── TOC tab ── */}
      {tab === 'toc' && (
        <>
          <div className="flex-1 overflow-y-auto">
            {chapters.length === 0 && (
              <p className="text-[10px] px-3 py-4" style={{ color: 'var(--df-muted)' }}>Loading…</p>
            )}
            {chapters.map((ch, i) => {
              const isActive = ch.page != null
                ? currentPage >= ch.page &&
                  (i === chapters.length - 1 || currentPage < (chapters[i + 1]?.page ?? totalPages + 1))
                : false;
              return (
                <button key={i}
                  onClick={() => ch.href ? onJumpHref(ch.href) : ch.page != null && onJumpPage(ch.page)}
                  className="w-full text-left px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    borderBottom: '1px solid var(--df-border)',
                    background: isActive ? 'rgba(79,110,247,0.12)' : 'transparent',
                    color: isActive ? 'var(--df-accent)' : 'var(--df-muted)',
                    fontWeight: isActive ? 500 : 400,
                    border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid',
                    borderBottomColor: 'var(--df-border)', cursor: 'pointer',
                  }}>
                  {i + 1}. {ch.title} {isActive ? '←' : ''}
                </button>
              );
            })}
          </div>

          {/* Bookmarks section */}
          <div className="shrink-0 p-2" style={{ borderTop: '1px solid var(--df-border)' }}>
            <p className="text-[9px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--df-muted)' }}>
              🔖 Bookmarks
            </p>
            {!bookmarks || bookmarks.length === 0
              ? <p className="text-[10px]" style={{ color: 'var(--df-border2)' }}>No bookmarks yet</p>
              : bookmarks.map((bm: DocBookmark) => (
                <div key={bm.id} className="flex items-center justify-between gap-1 group py-0.5">
                  <button
                    onClick={() => bm.cfi ? onJumpCfi(bm.cfi) : bm.page != null && onJumpPage(bm.page)}
                    className="text-[10px] truncate flex-1 text-left hover:underline"
                    style={{ color: 'var(--df-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {bm.label}
                  </button>
                  <button onClick={() => onDeleteBookmark(bm.id)}
                    className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--df-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ×
                  </button>
                </div>
              ))
            }
          </div>
        </>
      )}

      {/* ── Highlights & Notes tab ── */}
      {tab === 'highlights' && (
        <div className="flex-1 overflow-y-auto">
          {docHighlights.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-2xl mb-2">📝</p>
              <p className="text-[11px]" style={{ color: 'var(--df-muted)' }}>No highlights yet</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--df-border2)' }}>Select text to highlight</p>
            </div>
          ) : (
            docHighlights.map((h: Highlight) => (
              <div key={h.id} className="border-b group"
                style={{ borderBottomColor: 'var(--df-border)', borderBottomWidth: 1, borderBottomStyle: 'solid' }}>
                {/* Jump to location */}
                <button
                  onClick={() => {
                    if (h.page != null) onJumpPage(h.page);
                    else if (h.spineIndex != null) onJumpCfi(`spine:${h.spineIndex}`);
                  }}
                  className="w-full text-left px-3 pt-2 pb-1"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  {/* Colour stripe + text */}
                  <div className="flex gap-1.5">
                    <div className="w-0.5 rounded-full shrink-0 mt-0.5"
                      style={{ background: h.color, minHeight: 32 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] leading-relaxed line-clamp-3"
                        style={{ color: 'var(--df-text)', fontFamily: 'Georgia, serif' }}>
                        "{h.text}"
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: 'var(--df-muted)' }}>
                        {h.page != null ? `p.${h.page}` : h.spineIndex != null ? `ch.${h.spineIndex + 1}` : ''}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Note */}
                {editingNoteId === h.id ? (
                  <div className="px-3 pb-2">
                    <textarea
                      autoFocus rows={3}
                      className="w-full rounded px-2 py-1 text-[11px] text-white outline-none resize-none"
                      style={{ background: 'var(--df-border)', border: '1px solid var(--df-border2)' }}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => { onUpdateHighlightNote(h.id, noteText); setEditingNoteId(null); }}
                        className="text-[10px] px-2 py-0.5 rounded text-white"
                        style={{ background: 'var(--df-accent)', border: 'none', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingNoteId(null)}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : h.note ? (
                  <div className="px-3 pb-2">
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--df-muted)' }}>
                      📝 {h.note}
                    </p>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex items-center gap-1 px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingNoteId(h.id); setNoteText(h.note ?? ''); }}
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}>
                    {h.note ? '✏️ Edit' : '+ Note'}
                  </button>
                  <button onClick={() => onDeleteHighlight(h.id)}
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: 'none', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search input */}
          <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runSearch(); if (e.key === 'Escape') clearSearch(); }}
                placeholder="Search in book…"
                style={{
                  flex: 1, background: 'var(--df-surface)', border: '1px solid var(--df-border)',
                  borderRadius: 5, padding: '5px 8px', color: 'var(--df-text)', fontSize: 12, outline: 'none',
                }}
              />
              <button onClick={runSearch} disabled={searching || !searchQuery.trim()}
                style={{ background: 'var(--df-accent)', color: '#fff', border: 'none', borderRadius: 5,
                  padding: '0 8px', fontSize: 11, cursor: 'pointer', opacity: searching || !searchQuery.trim() ? 0.5 : 1, flexShrink: 0 }}>
                {searching ? '…' : '↵'}
              </button>
              {(searched || searchQuery) && (
                <button onClick={clearSearch}
                  style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', borderRadius: 5,
                    padding: '0 7px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>✕</button>
              )}
            </div>

            {/* Results count + nav */}
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 10, color: 'var(--df-muted)' }}>
                <span style={{ flex: 1 }}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}{searchResults.length >= 200 ? ' (max)' : ''}</span>
                <button onClick={() => goToResult(searchIdx - 1)} disabled={searchIdx === 0}
                  style={{ background: 'var(--df-border)', border: 'none', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', color: 'var(--df-muted)', opacity: searchIdx === 0 ? 0.3 : 1 }}>‹</button>
                <span style={{ minWidth: 40, textAlign: 'center', color: 'var(--df-text)', fontSize: 10 }}>{searchIdx + 1}/{searchResults.length}</span>
                <button onClick={() => goToResult(searchIdx + 1)} disabled={searchIdx >= searchResults.length - 1}
                  style={{ background: 'var(--df-border)', border: 'none', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', color: 'var(--df-muted)', opacity: searchIdx >= searchResults.length - 1 ? 0.3 : 1 }}>›</button>
              </div>
            )}
          </div>

          {/* Results list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px' }}>
            {searching && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: 11, color: 'var(--df-muted)' }}>
                Searching {totalPages} pages…
              </div>
            )}
            {!searching && searched && fileType === 'epub' && (
              <div style={{ textAlign: 'center', padding: '1rem 0', fontSize: 11, color: 'var(--df-muted)', lineHeight: 1.5 }}>
                {epubMatchCount === 0 ? `No matches for "${searchQuery}"` : `${epubMatchCount} match${epubMatchCount !== 1 ? 'es' : ''} highlighted`}
              </div>
            )}
            {!searching && searched && searchResults.length === 0 && fileType === 'pdf' && (
              <div style={{ textAlign: 'center', padding: '1rem 0', fontSize: 11, color: 'var(--df-muted)' }}>
                No results for "{searchQuery}"
              </div>
            )}
            {!searching && !searched && (
              <div style={{ textAlign: 'center', padding: '1rem 0', fontSize: 11, color: 'var(--df-muted)', lineHeight: 1.6 }}>
                {fileType === 'pdf' ? `Search across all ${totalPages} pages` : 'Search within current chapter'}
              </div>
            )}
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => goToResult(i)}
                style={{
                  width: '100%', textAlign: 'left', display: 'block', marginBottom: 3,
                  background: i === searchIdx ? 'rgba(79,110,247,0.12)' : 'transparent',
                  border: i === searchIdx ? '1px solid var(--df-accent)' : '1px solid transparent',
                  borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
                }}>
                <div style={{ fontSize: 10, color: 'var(--df-accent)', marginBottom: 2, fontWeight: 500 }}>p.{r.page}</div>
                <div style={{ fontSize: 11, color: 'var(--df-muted)', lineHeight: 1.4 }}>{highlightSnippet(r.snippet)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page Note modal ────────────────────────────────────────────────────────────
function PageNoteModal({
  page, spineIndex, existingNote, onSave, onClose,
}: {
  page: number | null; spineIndex: number | null;
  existingNote: string; onSave: (note: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(existingNote);
  const location = page != null ? `page ${page}` : spineIndex != null ? `chapter ${spineIndex + 1}` : 'here';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 340, background: 'var(--df-surface)', border: '1px solid var(--df-border)',
        }}>
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--df-border)' }}>
          <div>
            <p className="text-sm font-semibold text-white">📝 Page Note</p>
            <p className="text-[10px]" style={{ color: 'var(--df-muted)' }}>Reflection for {location}</p>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--df-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div className="p-4">
          <textarea
            autoFocus rows={6}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
            style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
            placeholder="Write your thoughts about this passage…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={onClose}
              className="flex-1 text-sm py-2 rounded-lg"
              style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => { onSave(text); onClose(); }}
              className="flex-1 text-sm py-2 rounded-lg font-semibold text-white"
              style={{ background: 'var(--df-accent)', border: 'none', cursor: 'pointer' }}>
              Save Note
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Edit Title modal ──────────────────────────────────────────────────────────
function EditTitleModal({ currentTitle, onSave, onClose }: {
  currentTitle: string; onSave: (title: string) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 320, background: 'var(--df-surface)', border: '1px solid var(--df-border)',
        }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--df-border)' }}>
          <p className="text-sm font-semibold text-white">✏️ Edit Title</p>
        </div>
        <div className="p-4">
          <input
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onSave(title.trim()); onClose(); } }}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={onClose}
              className="flex-1 text-sm py-2 rounded-lg"
              style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={() => { if (title.trim()) { onSave(title.trim()); onClose(); } }}
              className="flex-1 text-sm py-2 rounded-lg font-semibold text-white"
              style={{ background: 'var(--df-accent)', border: 'none', cursor: 'pointer' }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocumentReader({ doc, onClose, initialPage, initialSpineIndex }: Props) {
  const { updateLastPage, deleteDocument, updateTitle } = useDocumentStore();
  const { byDoc, fetchForDoc, addBookmark, deleteBookmark } = useBookmarkStore();
  const { addHighlight, fetchForDoc: fetchHighlightsForDoc, highlights, updateNote, deleteHighlight } = useHighlightStore();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [epubBlob, setEpubBlob] = useState<Blob | null>(null);
  const [loadingState, setLoadingState] = useState<'fetching' | 'ready' | 'error'>('fetching');
  const [loadingMsg, setLoadingMsg] = useState('Loading…');
  const [docTitle, setDocTitle] = useState(doc.title);

  const [currentPage, setCurrentPage] = useState(initialPage ?? (doc.lastPage || 1));
  const [totalPages, setTotalPages] = useState(doc.pageCount ?? 0);
  const [currentCfi, setCurrentCfi] = useState<string | undefined>(
    initialSpineIndex != null ? `spine:${initialSpineIndex}` : undefined
  );

  const [outline, setOutline] = useState<Chapter[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPageNote, setShowPageNote] = useState(false);
  const [showEditTitle, setShowEditTitle] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab | undefined>(undefined);
  const [activeSearchPhrase, setActiveSearchPhrase] = useState('');
  const epubIframeRef = useRef<HTMLIFrameElement | null>(null);

  const [jumpToPage, setJumpToPage] = useState<number | null>(initialPage ?? null);
  const [jumpToHref, setJumpToHref] = useState<string | null>(null);
  const [jumpToCfi, setJumpToCfi] = useState<string | null>(
    initialSpineIndex != null ? `spine:${initialSpineIndex}` : null
  );

  const bookmarks = byDoc[doc.id] ?? [];

  // Find existing page note for current location
  const currentSpineIndex = currentCfi?.startsWith('spine:')
    ? parseInt(currentCfi.replace('spine:', ''), 10)
    : null;
  const pageNote = highlights.find(h =>
    h.documentId === doc.id &&
    h.text === '__page_note__' &&
    (h.page === currentPage || h.spineIndex === currentSpineIndex)
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingState('fetching'); setLoadingMsg('Loading…');

      // File was deleted from storage — show a clear message instead of an error
      if (!doc.filePath) {
        if (!cancelled) { setLoadingState('error'); setLoadingMsg('File deleted from storage'); }
        return;
      }

      try {
        if (doc.fileType === 'pdf') {
          const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.filePath, 3600);
          if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No signed URL');
          if (!cancelled) { setPdfUrl(data.signedUrl); setLoadingState('ready'); }
          return;
        }
        setLoadingMsg('Downloading book…');
        const { data: blob, error } = await supabase.storage.from('documents').download(doc.filePath);
        if (error || !blob) throw new Error(error?.message ?? 'Download failed');
        if (!cancelled) { setEpubBlob(blob); setLoadingState('ready'); }
      } catch (e) {
        console.error('Document load failed:', e);
        if (!cancelled) setLoadingState('error');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [doc.filePath, doc.fileType]);

  useEffect(() => {
    fetchForDoc(doc.id);
    fetchHighlightsForDoc(doc.id);
  }, [doc.id, fetchForDoc, fetchHighlightsForDoc]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page); updateLastPage(doc.id, page);
  }, [doc.id, updateLastPage]);

  const handleEpubLocation = useCallback((cfi: string) => {
    setCurrentCfi(cfi); updateLastPage(doc.id, currentPage);
  }, [doc.id, updateLastPage, currentPage]);

  const handleTotalPages = useCallback((total: number) => { setTotalPages(total); }, []);

  const handleJumpPage = (page: number) => {
    setCurrentPage(page); setJumpToPage(page); updateLastPage(doc.id, page);
  };
  const handleJumpHref = (href: string) => setJumpToHref(href);
  const handleJumpCfi = (cfi: string) => setJumpToCfi(cfi);

  const handleAddBookmark = async () => {
    if (doc.fileType === 'epub') {
      if (!currentCfi) return;
      if (bookmarks.some(b => b.cfi === currentCfi)) return;
      await addBookmark(doc.id, `Location ${bookmarks.length + 1}`, null, currentCfi);
    } else {
      if (bookmarks.some(b => b.page === currentPage)) return;
      await addBookmark(doc.id, `Page ${currentPage}`, currentPage, null);
    }
  };

  const handleDeleteBookmark = (id: string) => deleteBookmark(id, doc.id);

  const handleDeleteDoc = () => { deleteDocument(doc.id); onClose(); };

  const handleHighlight = async (text: string, color: string, note: string) => {
    await addHighlight({
      documentId: doc.id, documentTitle: docTitle, text,
      note: note || null, color,
      page: doc.fileType === 'pdf' ? currentPage : null,
      spineIndex: doc.fileType === 'epub' ? (
        currentCfi?.startsWith('spine:') ? parseInt(currentCfi.replace('spine:', ''), 10) : null
      ) : null,
    });
  };

  // Save a page-level reflection note (stored as a special highlight with text='__page_note__')
  const handleSavePageNote = async (noteText: string) => {
    if (!noteText.trim()) return;
    if (pageNote) {
      // Update existing note
      await updateNote(pageNote.id, noteText);
    } else {
      // Create new page note using a sentinel text value
      await addHighlight({
        documentId: doc.id, documentTitle: docTitle,
        text: '__page_note__',
        note: noteText,
        color: HIGHLIGHT_COLORS[0]?.value ?? '#FBBF24',
        page: doc.fileType === 'pdf' ? currentPage : null,
        spineIndex: currentSpineIndex,
      });
    }
  };

  const handleSaveTitle = async (newTitle: string) => {
    await updateTitle(doc.id, newTitle);
    setDocTitle(newTitle);
  };

  const isBookmarked = doc.fileType === 'epub'
    ? bookmarks.some(b => b.cfi === currentCfi)
    : bookmarks.some(b => b.page === currentPage);

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  const btn: React.CSSProperties = {
    background: 'var(--df-border)', border: 'none', color: 'var(--df-muted)',
    borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
  };

  // Filter out page notes from visible highlights
  const visibleHighlights = highlights.filter(h => h.text !== '__page_note__');

  return (
    <div className="flex h-full" style={{ background: 'var(--df-bg)' }}>

      {/* Left sidebar */}
      {sidebarOpen && (
        <ReaderSidebar
          doc={doc}
          currentPage={currentPage} totalPages={totalPages}
          outline={outline} bookmarks={bookmarks}
          highlights={visibleHighlights}
          pdfUrl={pdfUrl}
          epubIframeRef={epubIframeRef}
          fileType={doc.fileType}
          initialTab={sidebarTab}
          onSearchPhraseChange={setActiveSearchPhrase}
          onJumpPage={handleJumpPage} onJumpHref={handleJumpHref} onJumpCfi={handleJumpCfi}
          onDeleteBookmark={handleDeleteBookmark}
          onUpdateHighlightNote={updateNote}
          onDeleteHighlight={deleteHighlight}
          onClose={onClose} />
      )}

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-2 shrink-0 flex-wrap"
          style={{ background: 'var(--df-surface2)', borderBottom: '1px solid var(--df-border)' }}>

          {!sidebarOpen && (
            <button onClick={onClose} style={btn}>‹</button>
          )}
          <button onClick={() => { setSidebarOpen(o => !o); setSidebarTab(undefined); setActiveSearchPhrase(''); }} style={btn} title="Toggle contents">☰</button>

          {/* Editable title */}
          <button
            onClick={() => setShowEditTitle(true)}
            className="flex-1 min-w-0 text-left group flex items-center gap-1"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            title="Edit title"
          >
            <span className="text-xs font-semibold text-white truncate">{docTitle}.{doc.fileType}</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
              style={{ color: 'var(--df-muted)' }}>✏️</span>
          </button>

          {/* Page note button */}
          <button
            onClick={() => setShowPageNote(true)}
            style={{ ...btn, color: pageNote ? 'var(--df-amber)' : 'var(--df-muted)' }}
            title={pageNote ? 'Edit page note' : 'Add page note'}
          >
            📝 Note
          </button>

          <button
            onClick={handleAddBookmark}
            style={{ ...btn, color: isBookmarked ? 'var(--df-accent)' : 'var(--df-muted)' }}
            title={isBookmarked ? 'Already bookmarked' : 'Bookmark this position'}
          >
            🔖 Bookmark
          </button>

          <button style={btn} title="Font size">Aa</button>

          <button
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab('search');
            }}
            style={{ ...btn, color: sidebarTab === 'search' && sidebarOpen ? 'var(--df-accent)' : 'var(--df-muted)' }}
            title="Search in book"
          >
            🔍
          </button>

          {pdfUrl && (
            <a href={pdfUrl} download={`${docTitle}.pdf`}
              style={{ ...btn, textDecoration: 'none' }} title="Download">⬇</a>
          )}

          {confirmDelete ? (
            <>
              <button onClick={handleDeleteDoc}
                style={{ ...btn, background: '#ef4444', color: '#fff' }}>Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} style={btn}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ ...btn, color: '#ef4444' }} title="Delete document">🗑</button>
          )}

          {/* Page nav (PDF only) */}
          {doc.fileType === 'pdf' && totalPages > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => handleJumpPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
                style={{ ...btn, width: 26, padding: 0, justifyContent: 'center', opacity: currentPage <= 1 ? 0.3 : 1 }}>‹</button>
              <span style={{ color: 'var(--df-muted)', fontSize: 11, minWidth: 80, textAlign: 'center' }}>
                Page {currentPage} / {totalPages}
              </span>
              <button onClick={() => handleJumpPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
                style={{ ...btn, width: 26, padding: 0, justifyContent: 'center', opacity: currentPage >= totalPages ? 0.3 : 1 }}>›</button>
            </div>
          )}
        </div>

        {/* Reader content */}
        <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
          {loadingState === 'fetching' && (
            <div className="flex items-center justify-center h-full" style={{ background: 'var(--df-bg)' }}>
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: 'var(--df-accent)', borderTopColor: 'transparent' }} />
                <p className="text-white text-sm">{loadingMsg}</p>
              </div>
            </div>
          )}
          {loadingState === 'error' && (
            <div className="flex items-center justify-center h-full p-8" style={{ background: 'var(--df-bg)' }}>
              <div className="text-center max-w-xs">
                {!doc.filePath ? (
                  <>
                    <p className="text-4xl mb-4">🗑</p>
                    <p className="text-white text-sm font-semibold mb-2">File deleted from storage</p>
                    <p className="text-xs mb-4" style={{ color: 'var(--df-muted)' }}>
                      The PDF was removed to free up space. Your reading history, highlights, and notes are still saved.
                      Re-upload the PDF to read it again.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-4">⚠️</p>
                    <p className="text-white text-sm font-semibold mb-2">Could not load document</p>
                    <p className="text-xs mb-4" style={{ color: 'var(--df-muted)' }}>Check your connection and try again.</p>
                  </>
                )}
                <button onClick={onClose}
                  style={{ color: 'var(--df-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                  ← Back to library
                </button>
              </div>
            </div>
          )}
          {loadingState === 'ready' && doc.fileType === 'pdf' && pdfUrl && (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full" style={{ background: 'var(--df-bg)' }}>
                <p className="text-sm animate-pulse" style={{ color: 'var(--df-muted)' }}>Initializing PDF reader…</p>
              </div>
            }>
              <PdfReader url={pdfUrl} initialPage={doc.lastPage || 1}
                onPageChange={handlePageChange} onTotalPages={handleTotalPages}
                onOutline={items => setOutline(items)}
                onHighlight={handleHighlight}
                pageHighlights={visibleHighlights
                  .filter(h => h.documentId === doc.id && h.page === currentPage)
                  .map(h => ({ text: h.text, color: h.color }))}
                jumpTo={jumpToPage} onJumpHandled={() => setJumpToPage(null)}
                searchPhrase={activeSearchPhrase ? activeSearchPhrase : undefined} />
            </Suspense>
          )}
          {loadingState === 'ready' && doc.fileType === 'epub' && epubBlob && (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full" style={{ background: 'var(--df-bg)' }}>
                <p className="text-sm animate-pulse" style={{ color: 'var(--df-muted)' }}>Opening book…</p>
              </div>
            }>
              <EpubReader blob={epubBlob}
                initialCfi={currentCfi}
                onLocationChange={handleEpubLocation} onTotalLocations={handleTotalPages}
                onOutline={items => setOutline(items)}
                onHighlight={handleHighlight}
                chapterHighlights={visibleHighlights
                  .filter(h => h.documentId === doc.id && h.spineIndex != null)
                  .map((h: Highlight) => ({ text: h.text, color: h.color, spineIndex: h.spineIndex! }))}
                externalIframeRef={epubIframeRef}
                jumpToHref={jumpToHref} onJumpHrefHandled={() => setJumpToHref(null)}
                jumpToCfi={jumpToCfi} onJumpCfiHandled={() => setJumpToCfi(null)} />
            </Suspense>
          )}
        </div>

        {/* Bottom progress bar */}
        <div className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ background: 'var(--df-surface2)', borderTop: '1px solid var(--df-border)' }}>
          <span className="text-[10px] shrink-0" style={{ color: 'var(--df-muted)' }}>1</span>
          <div className="flex-1 h-0.5 rounded-full" style={{ background: 'var(--df-border)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: 'var(--df-accent)' }} />
          </div>
          <span className="text-[10px] shrink-0" style={{ color: 'var(--df-muted)' }}>
            {totalPages || '…'}
          </span>
          <span className="text-[10px] ml-1 hidden sm:block" style={{ color: 'var(--df-muted)' }}>
            {progress}% read · Last opened today
          </span>
        </div>
      </div>

      {/* Page Note modal */}
      {showPageNote && (
        <PageNoteModal
          page={doc.fileType === 'pdf' ? currentPage : null}
          spineIndex={currentSpineIndex}
          existingNote={pageNote?.note ?? ''}
          onSave={handleSavePageNote}
          onClose={() => setShowPageNote(false)}
        />
      )}

      {/* Edit Title modal */}
      {showEditTitle && (
        <EditTitleModal
          currentTitle={docTitle}
          onSave={handleSaveTitle}
          onClose={() => setShowEditTitle(false)}
        />
      )}
    </div>
  );
}
