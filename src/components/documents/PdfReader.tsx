import { useState, useEffect, useCallback, useRef } from 'react';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import { useSwipe } from '@/hooks/useSwipe';
import HighlightPopup from './HighlightPopup';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface OutlineItem { title: string; page: number; }
interface SelectionState { text: string; x: number; y: number; }
interface HighlightItem { text: string; color: string; }

// A rendered highlight rect in CSS-pixel space relative to the Page element
interface HighlightRect { x: number; y: number; w: number; h: number; color: string; }

interface Props {
  url: string;
  initialPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (total: number) => void;
  onOutline?: (items: OutlineItem[]) => void;
  onHighlight?: (text: string, color: string, note: string) => void;
  pageHighlights?: HighlightItem[];
  jumpTo?: number | null;
  onJumpHandled?: () => void;
  searchPhrase?: string; // flash-highlight this phrase on the current page
}

// Use pdfjs to find text positions and return bounding rects for matched text

// Normalise typographic variants so highlights match regardless of quote/dash style
function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′‵`´]/g, "'")
    .replace(/[“”„‟″‶]/g, '"')
    .replace(/[–—―−‑‐­]/g, '-')
    .replace(/[     ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
async function getHighlightRects(
  url: string,
  pageNum: number,
  highlights: HighlightItem[],
  renderWidth: number, // CSS pixels width that react-pdf is rendering at
): Promise<HighlightRect[]> {
  if (!highlights.length) return [];
  try {
    const pdf = await pdfjs.getDocument(url).promise;
    const page = await pdf.getPage(pageNum);

    // Get the native (scale=1) viewport to find the PDF's natural dimensions
    const nativeVp = page.getViewport({ scale: 1 });
    // Scale to match what react-pdf renders at
    const scale = renderWidth / nativeVp.width;
    const vp = page.getViewport({ scale });

    const textContent = await page.getTextContent();

    // Build item-level position list (not char-level — more reliable)
    interface ItemMeta { str: string; x: number; y: number; w: number; h: number; }
    const items: ItemMeta[] = [];
    let flat = '';

    for (const raw of textContent.items as {
      str: string; transform: number[]; width: number; height: number; hasEOL?: boolean;
    }[]) {
      if (!raw.str) continue;
      // Use pdfjs viewport's own transform to convert PDF coords → CSS pixel coords.
      // convertToViewportPoint handles the Y-axis flip and scale correctly.
      const [, , , , tx, ty] = raw.transform;
      const [cssX, cssYBottom] = vp.convertToViewportPoint(tx, ty);
      // cssYBottom is the bottom of the text (pdfjs flips Y so baseline maps to bottom)
      // Subtract scaled height to get the top
      const cssH = Math.max(raw.height * scale, 8);
      const cssY = cssYBottom - cssH;
      const cssW = raw.width * scale;

      items.push({ str: raw.str, x: cssX, y: cssY, w: cssW, h: cssH });
      flat += raw.str;
      if (raw.hasEOL) flat += '\n';
      else flat += ' ';
    }


    const flatNorm = normaliseText(flat);
    const rects: HighlightRect[] = [];

    for (const hl of highlights) {
      const needle = normaliseText(hl.text);
      if (!needle) continue;

  
      // Find the needle in the normalised flat string
      const mStart = flatNorm.indexOf(needle);
      if (mStart === -1) {
            continue;
      }
      const mEnd = mStart + needle.length;
  
      // Find which items overlap the match range
      let pos = 0;
      const affectedItems: ItemMeta[] = [];
      for (const item of items) {
        const itemEnd = pos + item.str.length + 1; // +1 for separator
        if (pos < mEnd && itemEnd > mStart) {
          affectedItems.push(item);
        }
        pos = itemEnd;
      }

      if (!affectedItems.length) continue;

      // Group into lines by Y position
      const lines: ItemMeta[][] = [];
      for (const item of affectedItems) {
        const existing = lines.find(l => l.length > 0 && Math.abs(l[0]!.y - item.y) < item.h * 0.5);
        if (existing) existing.push(item);
        else lines.push([item]);
      }

      for (const line of lines) {
        if (!line.length) continue;
        const x = Math.min(...line.map(i => i.x));
        const y = Math.min(...line.map(i => i.y));
        const right = Math.max(...line.map(i => i.x + i.w));
        const h = Math.max(...line.map(i => i.h));
        rects.push({ x, y, w: right - x, h, color: hl.color });
      }
    }

    return rects;
  } catch (e) {
    console.warn('[PdfReader] getHighlightRects failed:', e);
    return [];
  }
}


export default function PdfReader({
  url, initialPage, onPageChange, onTotalPages,
  onOutline, onHighlight, pageHighlights, jumpTo, onJumpHandled,
  searchPhrase,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);
  const [searchRects, setSearchRects] = useState<HighlightRect[]>([]);
  const [searchFlash, setSearchFlash] = useState(false);
  const searchFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // ── Container width ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth - 32));
    ro.observe(el);
    setContainerWidth(el.clientWidth - 32);
    return () => ro.disconnect();
  }, []);

  const pageWidth = containerWidth * scale;

  // ── Compute highlight rects whenever page or highlights change ───────────
  useEffect(() => {
    if (!pageHighlights?.length) { setHighlightRects([]); return; }
    getHighlightRects(url, pageNumber, pageHighlights, pageWidth)
      .then(rects => {
            setHighlightRects(rects);
      });
  }, [url, pageNumber, pageHighlights, pageWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compute search phrase rects whenever phrase or page changes ──────────
  useEffect(() => {
    if (!searchPhrase?.trim()) { setSearchRects([]); return; }
    getHighlightRects(url, pageNumber, [{ text: searchPhrase, color: '#f97316' }], pageWidth)
      .then(rects => setSearchRects(rects));
  }, [url, pageNumber, searchPhrase, pageWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Jump to page ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (jumpTo != null && jumpTo !== pageNumber) {
      const clamped = Math.max(1, Math.min(jumpTo, numPages || jumpTo));
      setPageNumber(clamped);
      onPageChange(clamped);
      onJumpHandled?.();
    }
  }, [jumpTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    setPageNumber(p => { const n = Math.min(p + 1, numPages); onPageChange(n); return n; });
  }, [numPages, onPageChange]);

  const goPrev = useCallback(() => {
    setPageNumber(p => { const n = Math.max(p - 1, 1); onPageChange(n); return n; });
  }, [onPageChange]);

  const swipeHandlers = useSwipe({ onSwipeLeft: goNext, onSwipeRight: goPrev, threshold: 40, maxVertical: 100 });

  // ── Document load + outline ──────────────────────────────────────────────
  const onDocumentLoad = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    onTotalPages(n);
    if (onOutline) {
      pdfjs.getDocument(url).promise.then(async (pdf) => {
        const rawOutline = await pdf.getOutline();
        if (!rawOutline?.length) { onOutline([]); return; }
        const items: OutlineItem[] = [];
        for (const item of rawOutline) {
          try {
            let dest = item.dest;
            if (typeof dest === 'string') dest = await pdf.getDestination(dest);
            if (!Array.isArray(dest) || !dest.length) continue;
            const ref = dest[0];
            let pageIndex: number;
            if (typeof ref === 'object' && ref !== null && 'num' in ref) {
              pageIndex = await pdf.getPageIndex(ref as { num: number; gen: number });
            } else if (typeof ref === 'number') { pageIndex = ref; }
            else continue;
            items.push({ title: item.title ?? `Section ${items.length + 1}`, page: pageIndex + 1 });
          } catch { /* skip */ }
        }
        onOutline(items.length > 0 ? items : []);
      }).catch(() => onOutline([]));
    }
  }, [onTotalPages, onOutline, url]);

  const progress = numPages > 0 ? Math.round((pageNumber / numPages) * 100) : 0;

  // ── Text selection → highlight popup ────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (text.length < 3) { setSelection(null); return; }
    const range = sel?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    if (rect) setSelection({ text, x: rect.left + rect.width / 2, y: rect.bottom });
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--df-bg)' }}>
      {/* Outer wrapper — buttons are positioned here so they don't scroll */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* Fixed nav buttons — positioned relative to this non-scrolling wrapper */}
        <button onClick={goPrev} disabled={pageNumber <= 1}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-20 rounded-xl flex items-center justify-center text-white text-xl z-20 disabled:opacity-20 transition-colors"
          style={{ background: 'rgba(79,110,247,0.7)' }} aria-label="Previous page">‹</button>
        <button onClick={goNext} disabled={pageNumber >= numPages}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-20 rounded-xl flex items-center justify-center text-white text-xl z-20 disabled:opacity-20 transition-colors"
          style={{ background: 'rgba(79,110,247,0.7)' }} aria-label="Next page">›</button>

        {/* Scrollable page area — buttons above don't move with this */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex items-start justify-center p-4"
          onMouseUp={handleMouseUp}
          {...swipeHandlers}
        >
          {loading && (
            <div className="flex items-center justify-center h-64 w-full">
              <p className="text-sm animate-pulse" style={{ color: 'var(--df-muted)' }}>Loading document…</p>
            </div>
          )}

          {/* Page wrapper — highlight rects are positioned relative to this */}
          <div ref={pageWrapperRef} className="relative shadow-2xl">
            <PDFDocument
              file={url}
              onLoadSuccess={onDocumentLoad}
              onLoadError={() => setLoading(false)}
              loading={null}
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderAnnotationLayer
                renderTextLayer
                onRenderSuccess={() => setTimeout(() => setLoading(false), 0)}
                loading={<div className="bg-white rounded" style={{ width: pageWidth, height: pageWidth * 1.41 }} />}
              />
            </PDFDocument>

            {/* Highlight overlay — coordinate origin matches the Page canvas */}
            {highlightRects.map((r, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: r.x, top: r.y, width: r.w, height: r.h,
                  background: r.color + '40', borderRadius: 2, zIndex: 10,
                }}
              />
            ))}

            {/* Search phrase overlay — amber with border so it stands out */}
            {searchRects.map((r, i) => (
              <div
                key={`s${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: r.x - 2, top: r.y - 2, width: r.w + 4, height: r.h + 4,
                  background: 'rgba(251,191,36,0.35)',
                  border: '1.5px solid rgba(251,191,36,0.8)',
                  borderRadius: 3, zIndex: 15,
                  boxShadow: '0 0 0 2px rgba(251,191,36,0.15)',
                }}
              />
            ))}
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none opacity-60 md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}>swipe to turn page</div>
        </div>
      </div>

      {selection && onHighlight && (
        <HighlightPopup
          text={selection.text}
          x={selection.x}
          y={selection.y}
          onSave={(color, note) => { onHighlight(selection.text, color, note); setSelection(null); window.getSelection()?.removeAllRanges(); }}
          onDismiss={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
        />
      )}

      <div className="px-4 py-2 flex items-center gap-3 shrink-0"
        style={{ background: 'var(--df-surface2)', borderTop: '1px solid var(--df-border)' }}>
        <span className="text-xs" style={{ color: 'var(--df-muted)' }}>{pageNumber}</span>
        <div className="flex-1 h-0.5 rounded-full" style={{ background: 'var(--df-border)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--df-accent)' }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--df-muted)' }}>{numPages}</span>
        <span className="text-xs ml-1" style={{ color: 'var(--df-muted)' }}>{progress}%</span>
        <div className="hidden md:flex items-center gap-1 ml-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="w-7 h-7 rounded flex items-center justify-center text-sm"
            style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}>−</button>
          <span className="text-xs w-10 text-center" style={{ color: 'var(--df-muted)' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))}
            className="w-7 h-7 rounded flex items-center justify-center text-sm"
            style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}>+</button>
        </div>
      </div>
    </div>
  );
}
