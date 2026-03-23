import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useDocumentStore } from '@/store/documentStore';
import { useHighlightStore } from '@/store/highlightStore';
import { useReadingGoalStore } from '@/store/readingGoalStore';
import DocumentReader from '@/components/documents/DocumentReader';
import type { Document } from '@/types';
import { extractPdfMeta, extractEpubMeta } from '@/lib/extractBookMeta';
import { parseBookFilename } from '@/lib/parseBookFilename';
import { usePagination, PAGE_SIZE } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';
import NotebookPage from './notebook';
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek } from 'date-fns';

type ReadTab = 'insight' | 'queue' | 'reading' | 'archive' | 'notebook';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
}
function daysBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  try { return Math.abs(differenceInDays(parseISO(b), parseISO(a))); } catch { return null; }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--df-surface)', border: '1px solid var(--df-border)',
  borderRadius: 12, padding: '1rem',
};
const btnPrimary: React.CSSProperties = {
  background: 'var(--df-accent)', color: '#fff', border: 'none',
  borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
};
const btnOutline: React.CSSProperties = {
  background: 'transparent', color: 'var(--df-muted)', border: '1px solid var(--df-border)',
  borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  background: 'transparent', color: '#ef4444', border: '1px solid #ef4444',
  borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
};
const btnSuccess: React.CSSProperties = {
  background: 'var(--df-green)', color: '#fff', border: 'none',
  borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
};

// ── Book cover placeholder ────────────────────────────────────────────────────
function BookCover({ doc, size = 56 }: { doc: Document; size?: number }) {
  const colors = ['#4F6EF7','#10B981','#F59E0B','#EC4899','#7C3AED','#0D9488','#EF4444','#6366F1'];
  const bg = colors[doc.id.charCodeAt(0) % colors.length] ?? '#4F6EF7';
  if (doc.coverUrl) return (
    <img src={doc.coverUrl} alt={doc.title}
      style={{ width: size, height: size * 1.4, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{ width: size, height: size * 1.4, borderRadius: 4, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word' }}>
        {doc.title}
      </span>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }: {
  title: string; body: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth: 380, width: '100%' }}>
        <p style={{ fontWeight:500,color:'var(--df-text)',marginBottom:8,fontSize:15 }}>{title}</p>
        <p style={{ fontSize:13,color:'var(--df-muted)',marginBottom:20,lineHeight:1.6 }}>{body}</p>
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button style={danger ? btnDanger : btnPrimary} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Date picker modal ─────────────────────────────────────────────────────────
function DateModal({ title, startDate, finishedDate, showFinished = false, onSave, onClose }: {
  title: string; startDate: string | null; finishedDate?: string | null;
  showFinished?: boolean; onSave: (start: string, fin?: string) => void; onClose: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [start, setStart] = useState(startDate ? format(parseISO(startDate), 'yyyy-MM-dd') : today);
  const [fin, setFin] = useState(finishedDate ? format(parseISO(finishedDate), 'yyyy-MM-dd') : today);
  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth: 340, width: '100%' }}>
        <p style={{ fontWeight:500,color:'var(--df-text)',marginBottom:16,fontSize:15 }}>{title}</p>
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Start date</label>
        <input type="date" max={today} value={start} onChange={e=>setStart(e.target.value)}
          style={{ width:'100%',marginBottom:12,background:'var(--df-surface2)',border:'1px solid var(--df-border)',
            borderRadius:6,padding:'6px 10px',color:'var(--df-text)',fontSize:13 }} />
        {showFinished && <>
          <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Finished date</label>
          <input type="date" max={today} value={fin} onChange={e=>setFin(e.target.value)}
            style={{ width:'100%',marginBottom:12,background:'var(--df-surface2)',border:'1px solid var(--df-border)',
              borderRadius:6,padding:'6px 10px',color:'var(--df-text)',fontSize:13 }} />
        </>}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} onClick={() => { onSave(start, showFinished ? fin : undefined); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Notes modal ───────────────────────────────────────────────────────────────
function NotesModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const { highlights } = useHighlightStore();
  const notes = highlights.filter(h => h.documentId === doc.id && h.text !== '__page_note__' && h.note);
  const pageNotes = highlights.filter(h => h.documentId === doc.id && h.text === '__page_note__' && h.note);
  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth: 480, width:'100%', maxHeight:'70vh', display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <p style={{ fontWeight:500,color:'var(--df-text)',fontSize:14 }}>📝 Notes — {doc.title}</p>
          <button style={{ ...btnOutline,padding:'4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {notes.length === 0 && pageNotes.length === 0 && (
            <p style={{ fontSize:13,color:'var(--df-muted)',textAlign:'center',padding:'2rem 0' }}>No notes yet.</p>
          )}
          {pageNotes.map(h => (
            <div key={h.id} style={{ borderBottom:'1px solid var(--df-border)',padding:'10px 0' }}>
              <p style={{ fontSize:11,color:'var(--df-muted)',marginBottom:4 }}>
                Page note · {h.page ? `p.${h.page}` : h.spineIndex != null ? `ch.${h.spineIndex+1}` : ''}
              </p>
              <p style={{ fontSize:13,color:'var(--df-text)',lineHeight:1.6 }}>{h.note}</p>
            </div>
          ))}
          {notes.map(h => (
            <div key={h.id} style={{ borderBottom:'1px solid var(--df-border)',padding:'10px 0' }}>
              <div style={{ display:'flex',gap:6,alignItems:'flex-start',marginBottom:6 }}>
                <div style={{ width:3,minHeight:32,borderRadius:2,background:h.color,flexShrink:0 }} />
                <p style={{ fontSize:12,color:'var(--df-muted)',fontStyle:'italic',lineHeight:1.5 }}>"{h.text}"</p>
              </div>
              <p style={{ fontSize:13,color:'var(--df-text)',lineHeight:1.6,marginLeft:9 }}>📝 {h.note}</p>
              <p style={{ fontSize:11,color:'var(--df-muted)',marginLeft:9,marginTop:2 }}>
                {h.page ? `p.${h.page}` : h.spineIndex != null ? `ch.${h.spineIndex+1}` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Goal edit modal ───────────────────────────────────────────────────────────
function GoalModal({ year, current, onSave, onClose }: {
  year: number; current: number; onSave: (g: number) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(String(current));
  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth:300,width:'100%' }}>
        <p style={{ fontWeight:500,color:'var(--df-text)',marginBottom:12,fontSize:15 }}>{year} Reading Goal</p>
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Books to read</label>
        <input type="number" min="1" max="365" value={val} onChange={e=>setVal(e.target.value)}
          style={{ width:'100%',marginBottom:16,background:'var(--df-surface2)',border:'1px solid var(--df-border)',
            borderRadius:6,padding:'8px 10px',color:'var(--df-text)',fontSize:16,textAlign:'center' }} />
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} onClick={() => { onSave(parseInt(val)||12); onClose(); }}>Save Goal</button>
        </div>
      </div>
    </div>
  );
}

// ── Manual Book Modal ────────────────────────────────────────────────────────
function ManualBookModal({ onSave, onClose }: {
  onSave: (title: string, author: string, pageCount: number, coverDataUrl: string | null) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCoverDataUrl(result);
      setCoverPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const canSave = title.trim().length > 0;

  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth:400,width:'100%' }}>
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <div>
            <p style={{ fontSize:16,fontWeight:500,color:'var(--df-text)',marginBottom:2 }}>📖 Add Book Manually</p>
            <p style={{ fontSize:12,color:'var(--df-muted)' }}>No file needed — track your physical book</p>
          </div>
          <button onClick={onClose}
            style={{ background:'none',border:'none',color:'var(--df-muted)',cursor:'pointer',fontSize:20,padding:0 }}>✕</button>
        </div>

        {/* Cover image picker */}
        <div style={{ display:'flex',gap:14,marginBottom:16,alignItems:'flex-start' }}>
          <div
            onClick={() => coverInputRef.current?.click()}
            style={{ width:72,height:100,borderRadius:6,border:'1.5px dashed var(--df-border2)',
              background:coverPreview ? 'transparent' : 'var(--df-surface2)',
              cursor:'pointer',flexShrink:0,overflow:'hidden',display:'flex',
              alignItems:'center',justifyContent:'center',fontSize:22 }}>
            {coverPreview
              ? <img src={coverPreview} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt="cover" />
              : '📷'}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => handleCoverFile(e.target.files?.[0])} />
          <div style={{ flex:1,minWidth:0 }}>
            <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Cover Image</label>
            <button onClick={() => coverInputRef.current?.click()}
              style={{ ...btnOutline, fontSize:11,padding:'5px 10px',marginBottom:6 }}>
              {coverPreview ? '✏️ Change' : '+ Upload cover'}
            </button>
            {coverPreview && (
              <button onClick={() => { setCoverDataUrl(null); setCoverPreview(null); }}
                style={{ ...btnOutline, fontSize:11,padding:'5px 10px',color:'var(--df-muted)' }}>
                Remove
              </button>
            )}
            <p style={{ fontSize:11,color:'var(--df-muted)',marginTop:4,lineHeight:1.4 }}>Optional. JPG or PNG.</p>
          </div>
        </div>

        {/* Fields */}
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>
          Book Title <span style={{ color:'#ef4444' }}>*</span>
        </label>
        <input
          autoFocus value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Atomic Habits"
          style={{ width:'100%',marginBottom:12,background:'var(--df-surface2)',
            border:'1px solid var(--df-border)',borderRadius:6,padding:'8px 10px',
            color:'var(--df-text)',fontSize:13,outline:'none' }}
        />

        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Author Name</label>
        <input
          value={author} onChange={e => setAuthor(e.target.value)}
          placeholder="e.g. James Clear"
          style={{ width:'100%',marginBottom:12,background:'var(--df-surface2)',
            border:'1px solid var(--df-border)',borderRadius:6,padding:'8px 10px',
            color:'var(--df-text)',fontSize:13,outline:'none' }}
        />

        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Total Pages</label>
        <input
          type="number" min="1" value={pages} onChange={e => setPages(e.target.value)}
          placeholder="e.g. 320"
          style={{ width:'100%',marginBottom:20,background:'var(--df-surface2)',
            border:'1px solid var(--df-border)',borderRadius:6,padding:'8px 10px',
            color:'var(--df-text)',fontSize:13,outline:'none' }}
        />

        {/* Footer */}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: canSave ? 1 : 0.4 }}
            disabled={!canSave}
            onClick={() => { onSave(title.trim(), author.trim(), parseInt(pages) || 0, coverDataUrl); onClose(); }}
          >
            Add to Reading List
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Note Modal ───────────────────────────────────────────────────────────
function AddNoteModal({ doc, onSave, onClose }: {
  doc: Document;
  onSave: (page: number, note: string) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(String(doc.lastPage ?? 1));
  const [note, setNote] = useState('');
  const canSave = note.trim().length > 0;

  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth:380,width:'100%' }}>
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16 }}>
          <div>
            <p style={{ fontSize:15,fontWeight:500,color:'var(--df-text)',marginBottom:2 }}>📝 Add Note</p>
            <p style={{ fontSize:12,color:'var(--df-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:280 }}>{doc.title}</p>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'var(--df-muted)',cursor:'pointer',fontSize:20,padding:0,marginLeft:8 }}>✕</button>
        </div>

        {/* Page */}
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Page #</label>
        <input
          type="number" min="1" max={doc.pageCount ?? 9999}
          value={page} onChange={e => setPage(e.target.value)}
          style={{ width:'100%',marginBottom:14,background:'var(--df-surface2)',
            border:'1px solid var(--df-border)',borderRadius:6,padding:'8px 10px',
            color:'var(--df-text)',fontSize:13,outline:'none' }}
        />

        {/* Note */}
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Note</label>
        <textarea
          autoFocus
          rows={4}
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Write your note or thought…"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSave) { onSave(parseInt(page)||1, note.trim()); onClose(); } }}
          style={{ width:'100%',marginBottom:16,background:'var(--df-surface2)',
            border:'1px solid var(--df-border)',borderRadius:6,padding:'8px 10px',
            color:'var(--df-text)',fontSize:13,outline:'none',resize:'vertical',fontFamily:'inherit' }}
        />

        <p style={{ fontSize:11,color:'var(--df-muted)',marginBottom:14 }}>Tip: Ctrl+Enter to save quickly</p>

        {/* Footer */}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: canSave ? 1 : 0.4 }}
            disabled={!canSave}
            onClick={() => { onSave(parseInt(page)||1, note.trim()); onClose(); }}
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── INSIGHT TAB ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function InsightTab({ docs, setTab, onOpenDoc }: {
  docs: Document[]; setTab: (t: ReadTab) => void; onOpenDoc: (d: Document) => void;
}) {
  const year = new Date().getFullYear();
  const { goal, fetchGoal, setGoal } = useReadingGoalStore();
  const { highlights } = useHighlightStore();
  const [showGoalModal, setShowGoalModal] = useState(false);

  useEffect(() => { fetchGoal(year); }, [fetchGoal, year]);

  const queue = docs.filter(d => d.status === 'queue');
  const reading = docs.filter(d => d.status === 'reading');
  const finished = docs.filter(d => d.status === 'finished');
  // Goal progress only counts books finished in the current year
  const finishedThisYear = finished.filter(d => {
    const date = d.finishedAt ?? d.updatedAt ?? d.createdAt;
    return date.startsWith(String(year));
  });
  const totalNotes = highlights.filter(h => h.text !== '__page_note__' && h.note).length;
  const goalNum = goal?.goal ?? 12;
  const pct = Math.min(100, Math.round((finishedThisYear.length / goalNum) * 100));

  // Top authors
  const authorMap: Record<string, number> = {};
  docs.forEach(d => { if (d.author) authorMap[d.author] = (authorMap[d.author] ?? 0) + 1; });
  const topAuthors = Object.entries(authorMap).sort((a,b) => b[1]-a[1]).slice(0,4);

  // Recent activity (last opened = sorted by createdAt descending)
  const recent = [...docs].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,3);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ textAlign:'center',marginBottom:24 }}>
        <h1 style={{ fontSize:24,fontWeight:500,color:'var(--df-text)',marginBottom:4 }}>Personal Dashboard</h1>
        <p style={{ fontSize:13,color:'var(--df-muted)' }}>Your reading life, at a glance.</p>
      </div>

      {/* Responsive CSS for insight grid */}
      
      {/* Goal card */}
      <div style={{ ...card, marginBottom:20 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <span style={{ fontSize:14,fontWeight:500,color:'var(--df-text)' }}>{year} Reading Goal</span>
          <button style={btnOutline} onClick={() => setShowGoalModal(true)}>Edit Goal</button>
        </div>
        <div style={{ textAlign:'center',marginBottom:8 }}>
          <span style={{ fontSize:36,fontWeight:500,color:'var(--df-text)' }}>{finishedThisYear.length}</span>
          <span style={{ fontSize:24,color:'var(--df-muted)',margin:'0 6px' }}>/</span>
          <span style={{ fontSize:36,fontWeight:500,color:'var(--df-text)' }}>{goalNum}</span>
          <p style={{ fontSize:13,color:'var(--df-muted)',marginTop:4 }}>Books Completed</p>
        </div>
        <div style={{ height:8,background:'var(--df-border)',borderRadius:4,overflow:'hidden' }}>
          <div style={{ height:'100%',width:`${pct}%`,background:'var(--df-accent)',borderRadius:4,transition:'width .4s' }} />
        </div>
        <p style={{ fontSize:12,color:'var(--df-accent)',textAlign:'center',marginTop:6 }}>{pct}%</p>
      </div>

      {/* Library stats */}
      <h2 style={{ fontSize:16,fontWeight:500,color:'var(--df-text)',marginBottom:12 }}>My Library</h2>
      <div className="insight-lib-grid">
        {[
          { n: queue.length, l: 'In Queue', t: 'queue' as ReadTab },
          { n: reading.length, l: 'Currently Reading', t: 'reading' as ReadTab },
          { n: finished.length, l: 'Finished', t: 'archive' as ReadTab },
          { n: totalNotes, l: 'Notes', t: null },
        ].map(({ n, l, t }) => (
          <div key={l} onClick={() => t && setTab(t)}
            style={{ background:'var(--df-surface2)',borderRadius:8,padding:'14px 10px',textAlign:'center',
              cursor: t ? 'pointer' : 'default', transition:'opacity .15s' }}
            onMouseEnter={e => t && ((e.currentTarget as HTMLDivElement).style.opacity='0.75')}
            onMouseLeave={e => t && ((e.currentTarget as HTMLDivElement).style.opacity='1')}>
            <div style={{ fontSize:28,fontWeight:500,color:'var(--df-text)' }}>{n}</div>
            <div style={{ fontSize:11,color:'var(--df-muted)',marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Bottom sections — vertical on mobile, horizontal on desktop */}
      <div className="insight-bottom-grid">
        <div style={card}>
          <h3 style={{ fontSize:13,fontWeight:500,color:'var(--df-text)',marginBottom:10 }}>Top Authors</h3>
          {topAuthors.length === 0
            ? <p style={{ fontSize:12,color:'var(--df-muted)' }}>No data yet</p>
            : topAuthors.map(([name, count], i) => (
              <div key={name} style={{ display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderBottom:'1px solid var(--df-border)',color:'var(--df-text)' }}>
                <span>{i+1}. {name}</span>
                <span style={{ color:'var(--df-muted)' }}>{count} {count===1?'book':'books'}</span>
              </div>
            ))
          }
        </div>
        <div style={card}>
          <h3 style={{ fontSize:13,fontWeight:500,color:'var(--df-text)',marginBottom:10 }}>Reading Status</h3>
          {[
            { label:'Queue', count: queue.length, color:'var(--df-muted)' },
            { label:'Reading', count: reading.length, color:'var(--df-accent)' },
            { label:'Finished', count: finished.length, color:'var(--df-green)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderBottom:'1px solid var(--df-border)',color:'var(--df-text)' }}>
              <span>{label}</span>
              <span style={{ color }}>{count}</span>
            </div>
          ))}
        </div>
        <div style={card}>
          <h3 style={{ fontSize:13,fontWeight:500,color:'var(--df-text)',marginBottom:10 }}>Recent Activity</h3>
          {recent.length === 0
            ? <p style={{ fontSize:12,color:'var(--df-muted)' }}>No books yet</p>
            : recent.map(d => (
              <button key={d.id} onClick={() => onOpenDoc(d)}
                style={{ width:'100%',textAlign:'left',background:'none',border:'none',cursor:'pointer',padding:'5px 0',borderBottom:'1px solid var(--df-border)' }}>
                <div style={{ fontSize:12,fontWeight:500,color:'var(--df-text)',marginBottom:1 }}>{d.title}</div>
                <div style={{ fontSize:11,color:'var(--df-muted)' }}>
                  {d.author ?? ''} · {fmt(d.startedAt ?? d.createdAt)}
                </div>
              </button>
            ))
          }
        </div>
      </div>

      {showGoalModal && (
        <GoalModal year={year} current={goalNum}
          onSave={g => setGoal(year, g)} onClose={() => setShowGoalModal(false)} />
      )}
    </div>
  );
}

// ── Inline edit modal ────────────────────────────────────────────────────────
function EditBookInfoModal({ doc, onSave, onClose }: {
  doc: Document;
  onSave: (title: string, author: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [author, setAuthor] = useState(doc.author ?? '');
  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ ...card, maxWidth:360,width:'100%' }}>
        <p style={{ fontWeight:500,color:'var(--df-text)',marginBottom:16,fontSize:15 }}>✏️ Edit Book Info</p>
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Title</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          style={{ width:'100%',marginBottom:12,background:'var(--df-surface2)',border:'1px solid var(--df-border)',
            borderRadius:6,padding:'7px 10px',color:'var(--df-text)',fontSize:13 }}
        />
        <label style={{ fontSize:12,color:'var(--df-muted)',display:'block',marginBottom:4 }}>Author</label>
        <input
          value={author} onChange={e => setAuthor(e.target.value)}
          placeholder="Author name"
          style={{ width:'100%',marginBottom:16,background:'var(--df-surface2)',border:'1px solid var(--df-border)',
            borderRadius:6,padding:'7px 10px',color:'var(--df-text)',fontSize:13 }}
        />
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} onClick={() => { if (title.trim()) { onSave(title.trim(), author.trim()); onClose(); } }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── QUEUE TAB ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function QueueTab({ docs, onStartReading, onOpenDoc, fileInputRef }: {
  docs: Document[];
  onStartReading: (d: Document) => void;
  onOpenDoc: (d: Document, addToReading?: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { deleteDocument, updateTitle, updateAuthor, uploadDocument, updatePageCountAndCover } = useDocumentStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const queue = docs.filter(d => d.status === 'queue');
  const { page: qPage, setPage: setQPage, totalPages: qTotalPages, pageItems: queuePage } = usePagination(queue, [queue.length]);

  const handleDropFile = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') return;
    if (file.size > 100 * 1024 * 1024) return;
    const parsed = parseBookFilename(file.name);
    const doc = await uploadDocument(file, parsed.title, parsed.author);
    if (doc) {
      (async () => {
        try {
          const meta = await extractPdfMeta(file);
          await updatePageCountAndCover(doc.id, meta.pageCount, meta.coverDataUrl);
        } catch (e) { console.warn('Meta extraction failed:', e); }
      })();
    }
  };

  const handleSaveInfo = async (id: string, title: string, author: string) => {
    await updateTitle(id, title);
    await updateAuthor(id, author);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:500,color:'var(--df-text)',marginBottom:4 }}>My Queue</h1>
          <p style={{ fontSize:13,color:'var(--df-muted)' }}>Your next chapter starts here.</p>
        </div>
        <span style={{ fontSize:14,fontWeight:500,color:'var(--df-accent)' }}>{queue.length} Books</span>
      </div>

      {queue.length === 0 ? (
        <div style={{ ...card, textAlign:'center',padding:'3rem' }}>
          <p style={{ fontSize:32,marginBottom:12 }}>📚</p>
          <p style={{ fontSize:14,fontWeight:500,color:'var(--df-text)',marginBottom:6 }}>Queue is empty</p>
          <p style={{ fontSize:13,color:'var(--df-muted)',marginBottom:16 }}>Upload a PDF or EPUB to start your reading list.</p>
          <button style={btnPrimary} onClick={() => fileInputRef.current?.click()}>+ Upload Book</button>
        </div>
      ) : (
        queuePage.map(doc => (
          <div key={doc.id} style={{ ...card, display:'flex',gap:14,marginBottom:12,alignItems:'flex-start' }}>
            {/* Cover — click opens reader WITHOUT moving to Reading */}
            <div style={{ cursor:'pointer',flexShrink:0 }} onClick={() => onOpenDoc(doc, false)}>
              <BookCover doc={doc} size={64} />
            </div>

            <div style={{ flex:1,minWidth:0 }}>
              {/* Title + author — click opens reader WITHOUT moving to Reading */}
              <button onClick={() => onOpenDoc(doc, false)}
                style={{ background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0,display:'block',width:'100%' }}>
                <div style={{ fontSize:15,fontWeight:500,color:'var(--df-text)',marginBottom:2,lineHeight:1.3 }}>
                  {doc.title}
                </div>
              </button>

              <div style={{ fontSize:12,color:'var(--df-muted)',marginBottom:2 }}>
                {doc.author || <span style={{ fontStyle:'italic',color:'var(--df-border2)' }}>No author set</span>}
              </div>

              {doc.pageCount
                ? <div style={{ fontSize:12,color:'var(--df-muted)',marginBottom:10 }}>{doc.pageCount} pages</div>
                : <div style={{ fontSize:11,color:'var(--df-border2)',marginBottom:10 }}>Page count loads on first open</div>
              }

              <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
                <button style={btnPrimary} onClick={() => onStartReading(doc)}>Start Reading →</button>
                <button style={btnOutline} onClick={() => setEditDoc(doc)}>✏️ Edit Info</button>
                <button style={btnDanger} onClick={() => setConfirmId(doc.id)}><span className="hidden sm:inline">Remove</span><span className="sm:hidden">✕</span></button>
              </div>
            </div>
          </div>
        ))
      )}
      {queue.length > PAGE_SIZE && <Pagination page={qPage} totalPages={qTotalPages} total={queue.length} pageSize={PAGE_SIZE} onPage={setQPage} />}

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor='var(--df-accent)'; (e.currentTarget as HTMLDivElement).style.background='rgba(79,110,247,0.06)'; }}
        onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor='var(--df-border2)'; (e.currentTarget as HTMLDivElement).style.background='transparent'; }}
        onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor='var(--df-border2)'; (e.currentTarget as HTMLDivElement).style.background='transparent'; const f = e.dataTransfer.files[0]; if (f) handleDropFile(f); }}
        style={{ border:'1.5px dashed var(--df-border2)',borderRadius:10,padding:'1.5rem',
          textAlign:'center',cursor:'pointer',marginTop:12,color:'var(--df-muted)',fontSize:13,transition:'all .15s' }}>
        Drop PDF / EPUB here or click to browse
      </div>

      {/* Confirm delete modal */}
      {confirmId && (
        <ConfirmModal title="Remove book?" danger
          body="This will permanently delete the book and all its highlights, bookmarks, and notes. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => deleteDocument(confirmId)}
          onClose={() => setConfirmId(null)} />
      )}

      {/* Edit book info modal */}
      {editDoc && (
        <EditBookInfoModal
          doc={editDoc}
          onSave={(title, author) => handleSaveInfo(editDoc.id, title, author)}
          onClose={() => setEditDoc(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── READING TAB ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function ReadingTab({ docs, onOpenDoc }: { docs: Document[]; onOpenDoc: (d: Document) => void }) {
  const { updateStatus, updateDates, deleteDocument, updateLastPage, fetchReadingDates, fetchPagesThisWeek } = useDocumentStore();
  const { addHighlight, highlights, fetchAll: fetchHighlights } = useHighlightStore();
  const [sessionDates, setSessionDates] = useState<Set<string>>(new Set());
  const [pagesThisWeek, setPagesThisWeek] = useState(0);

  const refreshStats = () => {
    fetchReadingDates().then(dates => setSessionDates(new Set(dates)));
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
    fetchPagesThisWeek(weekStartStr).then(setPagesThisWeek);
  };

  useEffect(() => { refreshStats(); }, []);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [finishId, setFinishId] = useState<string | null>(null);
  const [dateDocId, setDateDocId] = useState<string | null>(null);
  const [noteDocId, setNoteDocId] = useState<string | null>(null);
  const [notesDoc, setNotesDoc] = useState<Document | null>(null);
  const pageInputs = useRef<Record<string, number>>({});

  useEffect(() => { fetchHighlights(); }, [fetchHighlights]);

  const reading = docs.filter(d => d.status === 'reading');
  const { page: rPage, setPage: setRPage, totalPages: rTotalPages, pageItems: readingPage } = usePagination(reading, [reading.length]);

  // Days current streak — uses reading_sessions table (one row per day read)
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  let streak = 0;
  const startOffset = sessionDates.has(todayKey) ? 0 : 1;
  for (let i = startOffset; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (sessionDates.has(key)) streak++;
    else break;
  }

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handlePageChange = (doc: Document, page: number) => {
    if (!page || page < 1) return;
    pageInputs.current[doc.id] = page;
    clearTimeout(debounceTimers.current[doc.id]);
    debounceTimers.current[doc.id] = setTimeout(() => {
      updateLastPage(doc.id, page).then(() => refreshStats());
    }, 800);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ textAlign:'center',marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:500,color:'var(--df-text)',marginBottom:4 }}>Reading Progress</h1>
        <p style={{ fontSize:13,color:'var(--df-muted)' }}>Mapping the path to the final chapter.</p>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24 }}>
        {[
          { n: reading.length, l: 'Books in Progress' },
          { n: pagesThisWeek, l: 'Pages Read This Week' },
          { n: streak, l: 'Days Current Streak' },
        ].map(({ n, l }) => (
          <div key={l} style={{ background:'var(--df-surface2)',borderRadius:8,padding:'14px 10px',textAlign:'center' }}>
            <div style={{ fontSize:28,fontWeight:500,color:'var(--df-text)' }}>{n}</div>
            <div style={{ fontSize:11,color:'var(--df-muted)',marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize:16,fontWeight:500,color:'var(--df-text)',marginBottom:12 }}>Currently Reading</h2>

      {reading.length === 0 ? (
        <div style={{ ...card, textAlign:'center',padding:'3rem' }}>
          <p style={{ fontSize:32,marginBottom:12 }}>📖</p>
          <p style={{ fontSize:14,fontWeight:500,color:'var(--df-text)',marginBottom:6 }}>Nothing in progress</p>
          <p style={{ fontSize:13,color:'var(--df-muted)' }}>Start reading a book from your Queue.</p>
        </div>
      ) : readingPage.map(doc => {
        const pct = doc.pageCount ? Math.round((doc.lastPage / doc.pageCount) * 100) : 0;
        const dateDoc = dateDocId === doc.id ? doc : null;
        return (
          <div key={doc.id} style={{ ...card, marginBottom:14 }}>
            <div style={{ display:'flex',gap:14,alignItems:'flex-start' }}>
              <div style={{ cursor: doc.filePath ? 'pointer' : 'default' }} onClick={() => doc.filePath && onOpenDoc(doc)}>
                <BookCover doc={doc} size={64} />
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <button onClick={() => doc.filePath && onOpenDoc(doc)} style={{ background:'none',border:'none',cursor: doc.filePath ? 'pointer' : 'default',textAlign:'left',padding:0 }}>
                  <div style={{ fontSize:15,fontWeight:500,color:'var(--df-text)',marginBottom:2 }}>{doc.title}</div>
                </button>
                {!doc.filePath && <div style={{ fontSize:11,color:'var(--df-muted)',marginBottom:4,fontStyle:'italic' }}>📖 Physical / manual book</div>}
                {doc.author && <div style={{ fontSize:12,color:'var(--df-muted)',marginBottom:6 }}>{doc.author}</div>}

                <div style={{ fontSize:12,color:'var(--df-text)',marginBottom:4 }}>
                  Page <strong>{doc.lastPage}</strong>{doc.pageCount ? ` of ${doc.pageCount}` : ''}
                </div>
                {doc.pageCount && <>
                  <div style={{ height:4,background:'var(--df-border)',borderRadius:2,marginBottom:4 }}>
                    <div style={{ height:'100%',width:`${pct}%`,background:'var(--df-accent)',borderRadius:2 }} />
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--df-muted)',marginBottom:8 }}>
                    <span>Started {fmt(doc.startedAt)}</span>
                    <span style={{ color:'var(--df-accent)' }}>{pct}%</span>
                  </div>
                </>}

                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:12,color:'var(--df-muted)' }}>
                  <span>Current page:</span>
                  <input type="number" min="1" max={doc.pageCount ?? 9999}
                    defaultValue={doc.lastPage}
                    onChange={e => handlePageChange(doc, parseInt(e.target.value) || doc.lastPage)}
                    style={{ width:60,padding:'3px 6px',borderRadius:4,border:'1px solid var(--df-border)',
                      background:'var(--df-surface2)',color:'var(--df-text)',fontSize:12 }} />
                  <span style={{ color:'var(--df-green)',fontSize:11 }}>Auto Save!</span>
                  {(() => {
                    const count = highlights.filter(h => h.documentId === doc.id && h.note).length;
                    return count > 0 ? (
                      <span
                        onClick={() => setNotesDoc(doc)}
                        style={{ fontSize:11,color:'var(--df-accent)',cursor:'pointer',textDecoration:'underline',textUnderlineOffset:2 }}
                      >
                        {count} {count === 1 ? 'Note' : 'Notes'}
                      </span>
                    ) : null;
                  })()}
                </div>

                <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                  <button style={btnOutline} onClick={() => setDateDocId(doc.id)}>Edit Start Date</button>
                  <button style={{ ...btnOutline, color:'var(--df-accent)', borderColor:'var(--df-accent)' }} onClick={() => setNoteDocId(doc.id)}>📝 Add Note</button>
                  <button style={btnSuccess} onClick={() => setFinishId(doc.id)}><span className="hidden sm:inline">Mark Finished</span><span className="sm:hidden">✓</span></button>
                  <button style={btnDanger} onClick={() => setConfirmId(doc.id)}><span className="hidden sm:inline">Remove</span><span className="sm:hidden">✕</span></button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modals */}
      {confirmId && (
        <ConfirmModal title="Remove book?" danger
          body="This will permanently delete the book and all its data. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => deleteDocument(confirmId)}
          onClose={() => setConfirmId(null)} />
      )}
      {finishId && (
        <ConfirmModal title="Mark as finished?"
          body="This will move the book to your Archive. Once archived, it cannot return to Currently Reading unless deleted and re-uploaded."
          confirmLabel="Archive it"
          onConfirm={() => {
            const today = new Date().toISOString();
            updateStatus(finishId, 'finished', { finishedAt: today }).then(() => refreshStats());
          }}
          onClose={() => setFinishId(null)} />
      )}
      {dateDocId && (
        <DateModal title="Edit Start Date"
          startDate={docs.find(d=>d.id===dateDocId)?.startedAt ?? null}
          onSave={(start) => updateDates(dateDocId, new Date(start).toISOString(), docs.find(d=>d.id===dateDocId)?.finishedAt ?? null)}
          onClose={() => setDateDocId(null)} />
      )}
      {noteDocId && (() => {
        const doc = docs.find(d => d.id === noteDocId);
        if (!doc) return null;
        return (
          <AddNoteModal
            doc={doc}
            onSave={(page, note) => {
              addHighlight({
                documentId: doc.id,
                documentTitle: doc.title,
                text: '__page_note__',
                note,
                color: '#FBBF24',
                page,
                spineIndex: null,
              });
            }}
            onClose={() => setNoteDocId(null)}
          />
        );
      })()}
      <Pagination page={rPage} totalPages={rTotalPages} total={reading.length} pageSize={PAGE_SIZE} onPage={setRPage} />
      {notesDoc && <NotesModal doc={notesDoc} onClose={() => setNotesDoc(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── ARCHIVE TAB ───────────────────────────────────────────════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
function ArchiveTab({ docs, onOpenDoc }: { docs: Document[]; onOpenDoc: (d: Document) => void }) {
  const { deleteDocument, updateDates, deleteFileOnly } = useDocumentStore();
  const { highlights, fetchAll: fetchHighlights, addHighlight } = useHighlightStore();
  const [filterBy, setFilterBy] = useState<'all'|'year'|'month'|'yearmonth'>('all');
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2,'0'));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [dateDocId, setDateDocId] = useState<string | null>(null);
  const [notesDoc, setNotesDoc] = useState<Document | null>(null);
  const [noteDocId, setNoteDocId] = useState<string | null>(null);

  useEffect(() => { fetchHighlights(); }, [fetchHighlights]);

  const finished = docs.filter(d => d.status === 'finished');

  const filtered = finished.filter(d => {
    const fd = d.finishedAt ?? d.createdAt;
    const date = parseISO(fd);
    const y = format(date, 'yyyy');
    const m = format(date, 'MM');
    if (filterBy === 'year') return y === filterYear;
    if (filterBy === 'month') return m === filterMonth;
    if (filterBy === 'yearmonth') return y === filterYear && m === filterMonth;
    return true;
  });

  const totalPages = filtered.reduce((sum, d) => sum + (d.pageCount ?? 0), 0);
  const avgDays = filtered.length === 0 ? 0 :
    Math.round(filtered.reduce((sum, d) => sum + (daysBetween(d.startedAt, d.finishedAt ?? d.createdAt) ?? 0), 0) / filtered.length);

  // Paginate flat sorted list, then re-group the page's books by month
  const [aPage, setAPage] = useState(1);
  useEffect(() => { setAPage(1); }, [filtered.length, filterBy, filterYear, filterMonth]); // eslint-disable-line react-hooks/exhaustive-deps
  const aTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const sortedFiltered = [...filtered].sort((a,b) => new Date(b.finishedAt??b.createdAt).getTime() - new Date(a.finishedAt??a.createdAt).getTime());
  const pageBooks = sortedFiltered.slice((aPage - 1) * PAGE_SIZE, aPage * PAGE_SIZE);
  const groups: Record<string, Document[]> = {};
  pageBooks.forEach(d => {
    const key = format(parseISO(d.finishedAt ?? d.createdAt), 'MMMM yyyy');
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  const years = Array.from(new Set(finished.map(d => format(parseISO(d.finishedAt??d.createdAt),'yyyy')))).sort().reverse();
  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const monthNames: Record<string, string> = { '01':'January','02':'February','03':'March','04':'April','05':'May','06':'June','07':'July','08':'August','09':'September','10':'October','11':'November','12':'December' };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ textAlign:'center',marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:500,color:'var(--df-text)',marginBottom:4 }}>Reading Timeline</h1>
        <p style={{ fontSize:13,color:'var(--df-muted)' }}>A chronological journey through your finished books.</p>
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
        <span style={{ fontSize:13,color:'var(--df-muted)' }}>Filter By:</span>
        <select value={filterBy} onChange={e=>setFilterBy(e.target.value as typeof filterBy)}
          style={{ fontSize:12,padding:'5px 10px',border:'1px solid var(--df-border)',borderRadius:6,
            background:'var(--df-surface2)',color:'var(--df-text)' }}>
          <option value="all">All Time</option>
          <option value="year">By Year</option>
          <option value="month">By Month</option>
          <option value="yearmonth">Year + Month</option>
        </select>
        {(filterBy === 'year' || filterBy === 'yearmonth') && (
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)}
            style={{ fontSize:12,padding:'5px 10px',border:'1px solid var(--df-border)',borderRadius:6,
              background:'var(--df-surface2)',color:'var(--df-text)' }}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        )}
        {(filterBy === 'month' || filterBy === 'yearmonth') && (
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
            style={{ fontSize:12,padding:'5px 10px',border:'1px solid var(--df-border)',borderRadius:6,
              background:'var(--df-surface2)',color:'var(--df-text)' }}>
            {months.map(m => <option key={m} value={m}>{monthNames[m]}</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24 }}>
        {[
          { n: filtered.length, l: 'Books Finished' },
          { n: totalPages.toLocaleString(), l: 'Pages Read' },
          { n: `${avgDays} Days`, l: 'Avg. Read Time' },
        ].map(({ n, l }) => (
          <div key={l} style={{ background:'var(--df-surface2)',borderRadius:8,padding:'14px 10px',textAlign:'center' }}>
            <div style={{ fontSize:24,fontWeight:500,color:'var(--df-text)' }}>{n}</div>
            <div style={{ fontSize:11,color:'var(--df-muted)',marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...card,textAlign:'center',padding:'3rem' }}>
          <p style={{ fontSize:32,marginBottom:12 }}>🏆</p>
          <p style={{ fontSize:14,fontWeight:500,color:'var(--df-text)',marginBottom:6 }}>No finished books yet</p>
          <p style={{ fontSize:13,color:'var(--df-muted)' }}>Mark a book as finished from the Reading tab.</p>
        </div>
      ) : Object.entries(groups).map(([month, monthDocs]) => (
        <div key={month} style={{ marginBottom:20 }}>
          <div style={{ fontSize:15,fontWeight:500,color:'var(--df-text)',marginBottom:8,
            paddingBottom:6,borderBottom:'1px solid var(--df-border)' }}>{month}</div>
          {monthDocs.map(doc => {
            const fd = parseISO(doc.finishedAt ?? doc.createdAt);
            const days = daysBetween(doc.startedAt, doc.finishedAt ?? doc.createdAt);
            const noteCount = highlights.filter(h => h.documentId === doc.id && (h.note || h.text === '__page_note__')).length;
            return (
              <div key={doc.id} style={{ ...card,display:'flex',gap:12,alignItems:'flex-start',marginBottom:10 }}>
                <div style={{ textAlign:'center',minWidth:36,flexShrink:0 }}>
                  <div style={{ fontSize:18,fontWeight:500,color:'var(--df-text)' }}>{format(fd,'d')}</div>
                  <div style={{ fontSize:10,color:'var(--df-muted)',textTransform:'uppercase' }}>{format(fd,'MMM')}</div>
                </div>
                <div style={{ cursor:'pointer',flexShrink:0 }} onClick={() => onOpenDoc(doc)}>
                  <BookCover doc={doc} size={52} />
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <button onClick={() => onOpenDoc(doc)} style={{ background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0 }}>
                    <div style={{ fontSize:14,fontWeight:500,color:'var(--df-text)',marginBottom:2 }}>{doc.title}</div>
                  </button>
                  {doc.author && <div style={{ fontSize:12,color:'var(--df-muted)',marginBottom:4 }}>{doc.author}</div>}
                  <div style={{ fontSize:11,color:'var(--df-muted)',marginBottom:8 }}>
                    {doc.pageCount ? `${doc.pageCount} Pages` : ''}
                    {days != null ? ` · Finished in ${days} days` : ''}
                    {noteCount > 0 && <>
                      {' · '}
                      <span
                        onClick={() => setNotesDoc(doc)}
                        style={{ color:'var(--df-accent)',cursor:'pointer',textDecoration:'underline',textUnderlineOffset:2 }}
                      >
                        {noteCount} {noteCount === 1 ? 'Note' : 'Notes'}
                      </span>
                    </>}
                  </div>
                  <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                    <button style={btnOutline} onClick={() => setDateDocId(doc.id)}>Edit Dates</button>
                    <button style={{ ...btnOutline, color:'var(--df-accent)', borderColor:'var(--df-accent)' }} onClick={() => setNoteDocId(doc.id)}>📝 Add Note</button>
                    {doc.filePath && (
                      <button
                        style={{ ...btnOutline, color: 'var(--df-amber)', borderColor: 'var(--df-amber)' }}
                        onClick={() => setDeleteFileId(doc.id)}
                        title="Remove the PDF file from storage but keep reading history"
                      >
                        🗑 Delete File
                      </button>
                    )}
                    <button style={btnDanger} onClick={() => setConfirmId(doc.id)}><span className="hidden sm:inline">Remove</span><span className="sm:hidden">✕</span></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {confirmId && (
        <ConfirmModal title="Remove book?" danger
          body="This will permanently delete the book and all its data. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => deleteDocument(confirmId)}
          onClose={() => setConfirmId(null)} />
      )}
      {deleteFileId && (
        <ConfirmModal
          title="Delete PDF file?"
          body="This removes the PDF from storage to free up space, but keeps your reading history, highlights, notes, cover, author, and dates. You won't be able to open this book again unless you re-upload it."
          confirmLabel="Delete File"
          onConfirm={() => deleteFileOnly(deleteFileId)}
          onClose={() => setDeleteFileId(null)} />
      )}
      {dateDocId && (() => { const d = docs.find(x=>x.id===dateDocId)!; return (
        <DateModal title="Edit Dates" showFinished
          startDate={d?.startedAt??null} finishedDate={d?.finishedAt??null}
          onSave={(start,fin) => updateDates(dateDocId, new Date(start).toISOString(), fin ? new Date(fin).toISOString() : null)}
          onClose={() => setDateDocId(null)} />
      )})()}
      <Pagination page={aPage} totalPages={aTotalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setAPage} />
      {notesDoc && <NotesModal doc={notesDoc} onClose={() => setNotesDoc(null)} />}
      {noteDocId && (() => {
        const doc = docs.find(d => d.id === noteDocId);
        if (!doc) return null;
        return (
          <AddNoteModal
            doc={doc}
            onSave={(page, note) => {
              addHighlight({
                documentId: doc.id,
                documentTitle: doc.title,
                text: '__page_note__',
                note,
                color: '#FBBF24',
                page,
                spineIndex: null,
              });
            }}
            onClose={() => setNoteDocId(null)}
          />
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function DocumentsPage() {
  const { dismissDocsBadge, pendingDocOpen, clearPendingDocOpen } = useUIStore();
  const { documents, fetchAll, updateStatus, uploadDocument, updatePageCountAndCover, createManualBook } = useDocumentStore();
  const { fetchAll: fetchHighlights } = useHighlightStore();

  const [tab, setTab] = useState<ReadTab>('insight');
  const [openDoc, setOpenDoc] = useState<Document | null>(null);
  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [initialSpineIndex, setInitialSpineIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadStartTime, setUploadStartTime] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes per second
  const [uploadFileSize, setUploadFileSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') return; // PDF only as per setting
    if (file.size > 100 * 1024 * 1024) return; // 100MB limit

    // Parse filename to extract title and author
    const parsed = parseBookFilename(file.name);

    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(parsed.title);
    setUploadFileSize(file.size);
    setUploadStartTime(Date.now());
    setUploadSpeed(0);

    let lastLoaded = 0;
    let lastTime = Date.now();

    const doc = await uploadDocument(file, parsed.title, parsed.author, (pct) => {
      setUploadProgress(pct);
      // Calculate speed
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      if (elapsed > 0.3) {
        const loaded = (pct / 100) * file.size;
        const delta = loaded - lastLoaded;
        setUploadSpeed(delta / elapsed);
        lastLoaded = loaded;
        lastTime = now;
      }
    });

    if (doc) {
      setTab('queue');
      (async () => {
        try {
          const meta = await extractPdfMeta(file);
          await updatePageCountAndCover(doc.id, meta.pageCount, meta.coverDataUrl);
        } catch (e) {
          console.warn('Meta extraction failed:', e);
        }
      })();
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadSpeed(0);
    if (!doc) return;
  };

  const handleManualSave = async (title: string, author: string, pageCount: number, coverDataUrl: string | null) => {
    const doc = await createManualBook(title, author, pageCount, coverDataUrl);
    if (doc) setTab('reading');
  };

  useEffect(() => { fetchAll(); fetchHighlights(); }, [fetchAll, fetchHighlights]);

  useEffect(() => {
    if (!pendingDocOpen) return;
    const doc = documents.find(d => d.id === pendingDocOpen.documentId);
    if (doc) {
      setInitialPage(pendingDocOpen.page);
      setInitialSpineIndex(pendingDocOpen.spineIndex);
      setOpenDoc(doc);
      clearPendingDocOpen();
    }
  }, [pendingDocOpen, documents, clearPendingDocOpen]);

  const openReader = (doc: Document, page?: number | null) => {
    dismissDocsBadge();
    setInitialPage(page ?? null);
    setInitialSpineIndex(null);
    setOpenDoc(doc);
  };

  const handleStartReading = (doc: Document) => {
    const now = new Date().toISOString();
    updateStatus(doc.id, 'reading', { startedAt: now });
    setTab('reading');
    openReader(doc);
  };

  const handleClose = () => {
    setOpenDoc(null);
    setInitialPage(null);
    setInitialSpineIndex(null);
  };

  // Reader fullscreen
  if (openDoc) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'var(--df-bg)', paddingTop: 'env(safe-area-inset-top)' }}>
        <DocumentReader doc={openDoc} initialPage={initialPage} initialSpineIndex={initialSpineIndex} onClose={handleClose} />
      </div>
    );
  }

  const tabStyle = (t: ReadTab): React.CSSProperties => ({
    padding: '8px 18px', fontSize: 13, fontWeight: tab === t ? 500 : 400,
    color: tab === t ? '#fff' : 'var(--df-muted)',
    background: tab === t ? 'var(--df-accent)' : 'transparent',
    border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all .15s',
  });

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Tab bar */}
      <div style={{ display:'flex',gap:4,padding:'8px 16px',background:'var(--df-surface)',
        borderBottom:'1px solid var(--df-border)',marginBottom:0,flexWrap:'wrap' }}>
        {(['insight','queue','reading','archive','notebook'] as ReadTab[]).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div style={{ flex:1 }} />
        <button
          style={{ ...btnOutline, fontSize:12 }}
          onClick={() => setShowManual(true)}
        >
          + Manual
        </button>
        <button style={{ ...btnPrimary, fontSize:12, opacity: uploading ? 0.6 : 1 }}
          onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? `Uploading… ${uploadProgress}%` : '+ Upload'}
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:'none' }}
          onChange={e => { const f = e.target.files?.[0]; handleFileSelect(f); e.target.value = ''; }} />
      </div>

      <div style={{ padding:'1.5rem 1rem' }}>
        {tab === 'insight' && (
          <InsightTab docs={documents} setTab={setTab} onOpenDoc={d => openReader(d)} />
        )}
        {tab === 'queue' && (
          <QueueTab docs={documents} onStartReading={handleStartReading}
            fileInputRef={fileInputRef}
            onOpenDoc={(d, addToReading) => {
              if (addToReading) handleStartReading(d);
              else openReader(d);
            }} />
        )}
        {tab === 'reading' && (
          <ReadingTab docs={documents} onOpenDoc={d => openReader(d)} />
        )}
        {tab === 'archive' && (
          <ArchiveTab docs={documents} onOpenDoc={d => openReader(d)} />
        )}
        {tab === 'notebook' && (
          <NotebookPage />
        )}
      </div>

      {/* ── Manual book modal ── */}
      {showManual && (
        <ManualBookModal
          onSave={handleManualSave}
          onClose={() => setShowManual(false)}
        />
      )}

      {/* ── Upload progress overlay ── */}
      {uploading && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 70,
          background: 'var(--df-surface)', border: '1px solid var(--df-border)',
          borderRadius: 12, padding: '16px 20px', width: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(79,110,247,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 5l3-3 3 3" stroke="var(--df-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="var(--df-accent)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--df-text)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uploadFileName || 'Uploading book…'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--df-muted)' }}>
                {(() => {
                  const mb = (uploadFileSize / 1024 / 1024).toFixed(1);
                  const loaded = ((uploadProgress / 100) * uploadFileSize / 1024 / 1024).toFixed(1);
                  return `${loaded} MB of ${mb} MB`;
                })()}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--df-accent)', flexShrink: 0 }}>
              {uploadProgress}%
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--df-border)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'var(--df-accent)',
              width: `${uploadProgress}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Speed + ETA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--df-muted)' }}>
            <span>
              {uploadSpeed > 0
                ? `${uploadSpeed > 1024 * 1024
                    ? (uploadSpeed / 1024 / 1024).toFixed(1) + ' MB/s'
                    : (uploadSpeed / 1024).toFixed(0) + ' KB/s'}`
                : 'Calculating…'}
            </span>
            <span>
              {uploadSpeed > 0 && uploadProgress < 100
                ? (() => {
                    const remaining = (uploadFileSize * (1 - uploadProgress / 100)) / uploadSpeed;
                    if (remaining < 60) return `${Math.ceil(remaining)}s left`;
                    return `${Math.ceil(remaining / 60)}m left`;
                  })()
                : uploadProgress === 100 ? 'Processing…' : ''}
            </span>
          </div>

          {/* Decoded filename info */}
          {uploadFileName && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--df-border)' }}>
              <div style={{ fontSize: 10, color: 'var(--df-muted)', marginBottom: 3 }}>Detected from filename</div>
              <div style={{ fontSize: 11, color: 'var(--df-text)' }}>📖 {uploadFileName}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
