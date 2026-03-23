import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import type { Document } from '@/types';

const DOC_COLORS = ['#4F6EF7', '#10B981', '#F59E0B', '#EC4899', '#7C3AED', '#0D9488', '#EF4444', '#6366F1'];
function getDocColor(index: number): string { return DOC_COLORS[index % DOC_COLORS.length] ?? '#4F6EF7'; }

function DocThumbIcon({ type }: { type: 'pdf' | 'epub' }) {
  if (type === 'epub') return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff" opacity={0.7}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff" opacity={0.7}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

interface Props { onOpen: (doc: Document) => void; }

export default function DocumentLibrary({ onOpen }: Props) {
  const { documents, loading, uploading, fetchAll, uploadDocument, deleteDocument } = useDocumentStore();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleFile = async (file: File) => {
    setUploadError('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'epub') { setUploadError('Only PDF and EPUB files are supported.'); return; }
    if (file.size > 50 * 1024 * 1024) { setUploadError('File must be under 50 MB.'); return; }
    await uploadDocument(file, file.name.replace(/\.(pdf|epub)$/i, ''));
  };

  const sorted = [...documents]
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'name' ? a.title.localeCompare(b.title) : 0);

  return (
    <div className="p-4 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-semibold text-white" style={{ fontSize: 16 }}>📄 Documents</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--df-muted)' }}>
            {documents.length} document{documents.length !== 1 ? 's' : ''} · synced across devices
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy(s => s === 'recent' ? 'name' : 'recent')}
            className="text-xs px-3 py-1.5 rounded-md transition-colors"
            style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)', color: 'var(--df-muted)' }}
          >
            Sort: {sortBy === 'recent' ? 'Recent' : 'Name'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 rounded-md font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: 'var(--df-accent)' }}
          >
            {uploading ? 'Uploading…' : '+ Upload PDF / EPUB'}
          </button>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{
          border: `1.5px dashed ${dragOver ? 'var(--df-accent)' : 'var(--df-border2)'}`,
          background: dragOver ? 'rgba(79,110,247,0.06)' : 'transparent',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--df-muted)' }}>
          {dragOver ? 'Drop to upload' : 'Drop PDF or EPUB here · or browse files · Max 50MB'}
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,.epub" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {uploadError && (
        <p className="text-xs px-3 py-2 rounded-lg text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
          {uploadError}
        </p>
      )}

      {/* ── Search ── */}
      <input
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
        style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl animate-pulse" style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)', height: 140 }} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && documents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-sm font-semibold text-white">No documents yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--df-muted)' }}>Upload a PDF or EPUB to get started</p>
        </div>
      )}

      {/* ── Card grid ── */}
      {!loading && sorted.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
          {sorted.map((doc, i) => {
            const color = getDocColor(i);
            const pct = doc.pageCount ? Math.round((doc.lastPage / doc.pageCount) * 100) : 0;
            const complete = doc.pageCount != null && doc.lastPage >= doc.pageCount;
            const isConfirming = confirmDelete === doc.id;
            return (
              <div
                key={doc.id}
                className="rounded-xl overflow-hidden cursor-pointer group transition-all"
                style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--df-accent)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--df-border)'}
              >
                {/* Thumbnail */}
                <div
                  className="flex items-center justify-center relative"
                  style={{ height: 80, background: color }}
                  onClick={() => !isConfirming && onOpen(doc)}
                >
                  <DocThumbIcon type={doc.fileType} />
                  {/* Delete overlay button */}
                  {isConfirming ? (
                    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); setConfirmDelete(null); }}
                        className="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-semibold"
                      >Del</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                        className="text-[10px] text-white px-1"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(doc.id); }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white"
                    >×</button>
                  )}
                </div>

                {/* Info */}
                <div className="p-2" onClick={() => !isConfirming && onOpen(doc)}>
                  <p className="text-xs font-semibold text-white truncate leading-tight">{doc.title}</p>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--df-muted)' }}>
                    {doc.fileType.toUpperCase()} · {doc.pageCount ? (complete ? 'Done ✓' : `p.${doc.lastPage}/${doc.pageCount}`) : ''}
                  </p>
                  {doc.pageCount && (
                    <div className="mt-1.5 h-1 rounded-full" style={{ background: 'var(--df-border)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: complete ? 'var(--df-green)' : color }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Upload card */}
          <div
            className="rounded-xl flex items-center justify-center cursor-pointer transition-all"
            style={{ minHeight: 120, border: '1.5px dashed var(--df-border2)', background: 'transparent' }}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--df-accent)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--df-border2)'}
          >
            <span className="text-xs" style={{ color: 'var(--df-muted)' }}>+ Upload</span>
          </div>
        </div>
      )}

      {sorted.length === 0 && search && !loading && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--df-muted)' }}>No matches.</p>
      )}
    </div>
  );
}
