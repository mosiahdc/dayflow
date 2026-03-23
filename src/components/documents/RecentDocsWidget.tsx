import { useEffect } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useUIStore } from '@/store/uiStore';
import type { Document } from '@/types';

const DOC_COLORS = ['#4F6EF7', '#10B981', '#F59E0B', '#7C3AED', '#EC4899', '#0D9488'];

function getColor(index: number): string {
  return DOC_COLORS[index % DOC_COLORS.length] ?? '#4F6EF7';
}

export default function RecentDocsWidget() {
  const { documents, fetchAll } = useDocumentStore();
  const { setView, dismissDocsBadge } = useUIStore();

  useEffect(() => {
    if (documents.length === 0) fetchAll();
  }, [fetchAll, documents.length]);

  const recent = documents.slice(0, 3);
  if (recent.length === 0) return null;

  const handleViewAll = () => {
    setView('documents');
    dismissDocsBadge();
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ background: 'rgba(13,148,136,0.15)', borderBottom: '1px solid var(--df-border)' }}
      >
        <span className="text-white font-semibold text-sm">📄 Recent Docs</span>
        <button
          onClick={handleViewAll}
          className="text-xs px-2 py-1 rounded font-medium text-white transition-colors"
          style={{ background: '#0D9488' }}
        >
          View all
        </button>
      </div>
      <div>
        {recent.map((doc, i) => {
          const color = getColor(i);
          const pct = doc.pageCount ? Math.round((doc.lastPage / doc.pageCount) * 100) : 0;
          const complete = doc.pageCount != null && doc.lastPage >= doc.pageCount;
          return (
            <DocItem
              key={doc.id}
              doc={doc}
              color={color}
              pct={pct}
              complete={complete}
              onOpen={() => {
                setView('documents');
                dismissDocsBadge();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function DocItem({
  doc,
  color,
  pct,
  complete,
  onOpen,
}: {
  doc: Document;
  color: string;
  pct: number;
  complete: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left"
      style={{ borderBottom: '1px solid var(--df-border)' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      <div
        className="w-7 h-8 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" opacity={0.85}>
          {doc.fileType === 'epub' ? (
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          ) : (
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          )}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--df-text)' }}>{doc.title}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {doc.pageCount ? (
            <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
              {complete ? 'Done ✓' : `p.${doc.lastPage}/${doc.pageCount}`}
            </span>
          ) : (
            <span className="text-[10px] uppercase" style={{ color: 'var(--df-muted)' }}>{doc.fileType}</span>
          )}
        </div>
        {doc.pageCount && (
          <div className="w-full h-1 rounded-full mt-1" style={{ background: 'var(--df-border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: complete ? 'var(--df-green)' : color }}
            />
          </div>
        )}
      </div>
    </button>
  );
}
