import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Book } from 'epubjs';
import JSZip from 'jszip';
import type { NavItem } from 'epubjs';
import { useSwipe } from '@/hooks/useSwipe';
import HighlightPopup from './HighlightPopup';

interface EpubOutlineItem { title: string; href: string; }
interface SelectionState { text: string; x: number; y: number; }
interface ChapterHighlight { text: string; color: string; spineIndex: number; }

interface Props {
  blob: Blob;
  initialCfi?: string | undefined;
  onLocationChange: (cfi: string) => void;
  onTotalLocations: (total: number) => void;
  onOutline?: (items: EpubOutlineItem[]) => void;
  onHighlight?: (text: string, color: string, note: string) => void;
  chapterHighlights?: ChapterHighlight[];
  jumpToHref?: string | null;
  onJumpHrefHandled?: () => void;
  jumpToCfi?: string | null;
  onJumpCfiHandled?: () => void;
  externalIframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Resolve a relative URL against a base path (e.g. OEBPS/Text/ch01.xhtml)
function resolveHref(base: string, href: string): string {
  if (href.startsWith('http') || href.startsWith('blob:')) return href;
  const baseDir = base.includes('/') ? base.substring(0, base.lastIndexOf('/') + 1) : '';
  const parts = (baseDir + href).split('/');
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '..') resolved.pop();
    else if (p !== '.') resolved.push(p);
  }
  return resolved.join('/');
}

// Build a full self-contained HTML string for a chapter, inlining CSS and
// resolving image src attributes to blob: URLs from the zip
async function buildChapterHtml(
  zip: JSZip,
  chapterPath: string,
  fontSize: number,
  highlights: { text: string; color: string }[] = [],
): Promise<string> {
  const entry = zip.file(chapterPath);
  if (!entry) throw new Error(`Chapter not found: ${chapterPath}`);
  let html = await entry.async('string');

  // Inline all linked stylesheets
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const cssMatches = [...html.matchAll(linkRe)];
  for (const m of cssMatches) {
    if (!m[1]) continue;
    const cssPath = resolveHref(chapterPath, m[1]);
    const cssEntry = zip.file(cssPath);
    if (cssEntry) {
      const css = await cssEntry.async('string');
      html = html.replace(m[0], `<style>${css}</style>`);
    }
  }

  // Replace image src with blob: URLs
  const imgRe = /(<img[^>]+src=["'])([^"']+)(["'])/gi;
  const imgMatches = [...html.matchAll(imgRe)];
  for (const m of imgMatches) {
    if (!m[1] || !m[2] || !m[3]) continue;
    const imgPath = resolveHref(chapterPath, m[2]);
    const imgEntry = zip.file(imgPath);
    if (imgEntry) {
      const ext = imgPath.split('.').pop()?.toLowerCase() ?? 'png';
      const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
      const mime = mimeMap[ext] ?? 'image/png';
      const buf = await imgEntry.async('arraybuffer');
      const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
      html = html.replace(m[0], m[1] + blobUrl + m[3]);
    }
  }

  // Inject base font size, reading styles, and selection postMessage script
  const readerStyles = `
    <style>
      html, body { margin: 0; padding: 1.5rem 2rem; font-family: Georgia, "Times New Roman", serif;
        font-size: ${fontSize}%; line-height: 1.8; color: #1a1a2e; background: #fff; }
      img { max-width: 100%; height: auto; }
      a { color: #4F6EF7; }
      p { margin: 0 0 1em; }
      h1,h2,h3,h4 { margin: 1.2em 0 0.4em; line-height: 1.3; }
      ::selection { background: rgba(251,191,36,0.4); }
      mark.df-hl {
        border-radius: 2px;
        padding: 0 1px;
        display: inline;
      }
    </style>
    <script>
      // Selection reporting
      document.addEventListener('mouseup', function() {
        var sel = window.getSelection();
        var text = sel ? sel.toString().trim() : '';
        if (text.length >= 3) {
          var range = sel.getRangeAt(0);
          var rect = range.getBoundingClientRect();
          window.parent.postMessage({
            type: 'epub-selection', text: text,
            x: rect.left + rect.width / 2, y: rect.bottom
          }, '*');
        } else {
          window.parent.postMessage({ type: 'epub-selection-clear' }, '*');
        }
      });

      // Live highlight injection — no reload needed
      function applyHighlights(highlights) {
        // Remove existing marks
        document.querySelectorAll('mark.df-hl').forEach(function(m) {
          var p = m.parentNode;
          if (p) { p.replaceChild(document.createTextNode(m.textContent || ''), m); p.normalize(); }
        });
        if (!highlights || !highlights.length) return;

        var body = document.body;
        var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
        var textNodes = [];
        var node;
        while ((node = walker.nextNode())) textNodes.push(node);

        // Build flat string
        var flat = '';
        var nodeMeta = [];
        textNodes.forEach(function(tn) {
          var t = tn.textContent || '';
          nodeMeta.push({ node: tn, start: flat.length, end: flat.length + t.length });
          flat += t;
        });
        var flatLower = flat.toLowerCase();

        highlights.forEach(function(hl) {
          var needle = hl.text.trim().toLowerCase();
          if (!needle) return;
          var mStart = flatLower.indexOf(needle);
          if (mStart < 0) return;
          var mEnd = mStart + needle.length;

          var affected = nodeMeta.filter(function(m) { return m.end > mStart && m.start < mEnd; });
          affected.forEach(function(meta) {
            var tn = meta.node;
            var t = tn.textContent || '';
            var lStart = Math.max(0, mStart - meta.start);
            var lEnd = Math.min(t.length, mEnd - meta.start);
            if (lStart >= lEnd) return;
            var before = t.slice(0, lStart);
            var matched = t.slice(lStart, lEnd);
            var after = t.slice(lEnd);
            var mark = document.createElement('mark');
            mark.className = 'df-hl';
            mark.textContent = matched;
            mark.style.background = hl.color + '66';
            mark.style.color = hl.color;
            var frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            frag.appendChild(mark);
            if (after) frag.appendChild(document.createTextNode(after));
            tn.parentNode.replaceChild(frag, tn);
          });
        });
      }

      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'apply-highlights') {
          applyHighlights(e.data.highlights);
        }
        if (e.data && e.data.type === 'search') {
          var q = (e.data.query || '').toLowerCase().trim();
          // Remove previous search marks
          document.querySelectorAll('mark.df-search').forEach(function(m) {
            var p = m.parentNode;
            if (p) { p.replaceChild(document.createTextNode(m.textContent || ''), m); p.normalize(); }
          });
          if (!q) return;
          var body = document.body;
          var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
          var nodes = [];
          var node;
          while ((node = walker.nextNode())) nodes.push(node);
          var flat = '';
          var meta = [];
          nodes.forEach(function(tn) {
            var t = tn.textContent || '';
            meta.push({ node: tn, start: flat.length, end: flat.length + t.length });
            flat += t;
          });
          var flatLower = flat.toLowerCase();
          var firstMatch = flatLower.indexOf(q);
          var count = 0;
          var idx = 0;
          while ((idx = flatLower.indexOf(q, idx)) !== -1) {
            var mEnd = idx + q.length;
            meta.forEach(function(m) {
              if (m.end <= idx || m.start >= mEnd) return;
              var tn2 = m.node;
              var t2 = tn2.textContent || '';
              var lStart = Math.max(0, idx - m.start);
              var lEnd = Math.min(t2.length, mEnd - m.start);
              if (lStart >= lEnd) return;
              var before = t2.slice(0, lStart);
              var matched = t2.slice(lStart, lEnd);
              var after = t2.slice(lEnd);
              var mark = document.createElement('mark');
              mark.className = 'df-search';
              mark.textContent = matched;
              mark.style.background = 'rgba(251,191,36,0.5)';
              mark.style.color = 'inherit';
              mark.style.borderRadius = '2px';
              var frag = document.createDocumentFragment();
              if (before) frag.appendChild(document.createTextNode(before));
              frag.appendChild(mark);
              if (after) frag.appendChild(document.createTextNode(after));
              tn2.parentNode.replaceChild(frag, tn2);
            });
            count++;
            idx = mEnd;
          }
          // Scroll first match into view
          var first = document.querySelector('mark.df-search');
          if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          window.parent.postMessage({ type: 'epub-search-result', count: count }, '*');
        }
      });
    </script>
  `;
  html = html.replace('</head>', readerStyles + '</head>');

  // Inject highlight marks for saved highlights matching this chapter
  if (highlights.length > 0) {
    for (const hl of highlights) {
      const trimmed = hl.text.trim();
      if (!trimmed) continue;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'gi');
      // Escape $ in replacement string to prevent special patterns
      const safeText = trimmed.replace(/\$/g, '$$$$');
      const markOpen = `<mark style="background:${hl.color}66;border-radius:2px;padding:0 1px;color:inherit;">`;
      html = html.replace(re, `${markOpen}${safeText}</mark>`);
    }
  }

  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EpubReader({
  blob, initialCfi, onLocationChange, onTotalLocations, onOutline,
  onHighlight, chapterHighlights, jumpToHref, onJumpHrefHandled, jumpToCfi, onJumpCfiHandled,
  externalIframeRef,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bookRef = useRef<Book | null>(null);
  const zipRef = useRef<JSZip | null>(null);
  const spineRef = useRef<{ href: string; id: string }[]>([]);
  const blobUrlsRef = useRef<string[]>([]); // track for cleanup
  const chapterHighlightsRef = useRef<ChapterHighlight[]>([]); // always-current highlights

  // Sync internal iframeRef to external so DocumentReader can send postMessages
  useEffect(() => {
    if (externalIframeRef) {
      (externalIframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = iframeRef.current;
    }
  });

  // Keep ref in sync so renderChapter (useCallback) reads latest without re-creating
  chapterHighlightsRef.current = chapterHighlights ?? [];

  const [toc, setToc] = useState<NavItem[]>([]);
  const [spineIndex, setSpineIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(100);
  const [showToc, setShowToc] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  // Listen for text selection postMessages from inside the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'epub-selection' && e.data.text?.trim().length >= 3) {
        const iframe = iframeRef.current;
        const rect = iframe?.getBoundingClientRect();
        setSelection({
          text: e.data.text.trim(),
          x: (rect?.left ?? 0) + (e.data.x ?? 0),
          y: (rect?.top ?? 0) + (e.data.y ?? 0),
        });
      }
      if (e.data?.type === 'epub-selection-clear') setSelection(null);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Load and render a chapter by its spine index
  const renderChapter = useCallback(async (idx: number) => {
    const zip = zipRef.current;
    const spine = spineRef.current;
    if (!zip || !spine.length || idx < 0 || idx >= spine.length) return;

    setLoading(true);
    try {
      const chapterPath = spine[idx]?.href;
      if (!chapterPath) return;
      const hlForChapter = chapterHighlightsRef.current
        .filter(h => h.spineIndex === idx)
        .map(h => ({ text: h.text, color: h.color }));
      const html = await buildChapterHtml(zip, chapterPath, fontSize, hlForChapter);

      // Write into our iframe via src blob URL (no srcdoc, no sandbox)
      const oldUrls = blobUrlsRef.current;
      const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      blobUrlsRef.current = [blobUrl];
      // Revoke previous chapter blobs
      oldUrls.forEach(u => URL.revokeObjectURL(u));

      if (iframeRef.current) {
        iframeRef.current.src = blobUrl;
      }

      setSpineIndex(idx);
      const pct = spine.length > 1 ? Math.round((idx / (spine.length - 1)) * 100) : 100;
      setProgress(pct);
      onLocationChange(`spine:${idx}`);
    } catch (e) {
      console.error('[EpubReader] render chapter failed:', e);
    } finally {
      setLoading(false);
    }
  }, [fontSize, onLocationChange]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        // Validate + fix MIME
        const zip = await JSZip.loadAsync(blob);
        const containerEntry = zip.file('META-INF/container.xml');
        if (!containerEntry) throw new Error('Not a valid EPUB: missing META-INF/container.xml');

        const containerXml = await containerEntry.async('string');
        const xmlDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) throw new Error('container.xml parse error');
        const rootfile = xmlDoc.querySelector('rootfile') ?? xmlDoc.getElementsByTagName('rootfile')[0];
        if (!rootfile) throw new Error('container.xml has no rootfile');

        const opfPath = rootfile.getAttribute('full-path') ?? '';
        const opfEntry = zip.file(opfPath);
        if (!opfEntry) throw new Error(`OPF file not found: ${opfPath}`);

        const opfXml = await opfEntry.async('string');
        const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');

        // Build manifest: id → href map
        const manifest: Record<string, string> = {};
        opfDoc.querySelectorAll('manifest item').forEach(item => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          if (id && href) manifest[id] = resolveHref(opfPath, href);
        });

        // Build spine from itemref order
        const spine: { href: string; id: string }[] = [];
        opfDoc.querySelectorAll('spine itemref').forEach(ref => {
          const idref = ref.getAttribute('idref') ?? '';
          const href = manifest[idref];
          if (href) spine.push({ href, id: idref });
        });

        if (spine.length === 0) throw new Error('EPUB spine is empty');

        zipRef.current = zip;
        spineRef.current = spine;
        onTotalLocations(spine.length);

        if (cancelled) return;

        // Use epubjs only for TOC extraction
        const fixedBlob = new Blob([await blob.arrayBuffer()], { type: 'application/epub+zip' });
        const blobUrl = URL.createObjectURL(fixedBlob);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const book = new (Book as any)(blobUrl, { openAs: 'epub' }) as Book;
        bookRef.current = book;

        book.loaded.navigation.then(nav => {
          if (cancelled) return;
          setToc(nav.toc);
          if (onOutline) {
            onOutline(nav.toc.map(item => ({ title: item.label.trim(), href: item.href })));
          }
        }).catch(() => {});

        // Find initial chapter
        let startIdx = 0;
        if (initialCfi?.startsWith('spine:')) {
          startIdx = parseInt(initialCfi.replace('spine:', ''), 10) || 0;
        }
        await renderChapter(startIdx);

      } catch (e) {
        console.error('[EpubReader] load failed:', e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open EPUB.');
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      try { bookRef.current?.destroy(); } catch {}
    };
  }, [blob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render chapter when font size changes
  useEffect(() => {
    if (zipRef.current && spineRef.current.length > 0) {
      renderChapter(spineIndex);
    }
  }, [fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // When highlights change for the current chapter, inject them into the live
  // iframe via postMessage — avoids a full reload/blink
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const relevant = (chapterHighlights ?? []).filter(h => h.spineIndex === spineIndex);
    iframeRef.current.contentWindow.postMessage(
      { type: 'apply-highlights', highlights: relevant },
      '*'
    );
  }, [chapterHighlights, spineIndex]);

  // Jump to href (from TOC)
  useEffect(() => {
    if (!jumpToHref) return;
    const spine = spineRef.current;
    // Normalize href: strip fragment and leading path
    const hrefBase = jumpToHref.split('#')[0] ?? jumpToHref;
    const idx = spine.findIndex(s =>
      s.href === hrefBase ||
      s.href.endsWith('/' + hrefBase) ||
      hrefBase.endsWith('/' + s.href) ||
      s.href.endsWith(hrefBase)
    );
    if (idx !== -1) renderChapter(idx);
    onJumpHrefHandled?.();
  }, [jumpToHref]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump to CFI (from bookmarks) — our CFIs are "spine:N"
  useEffect(() => {
    if (!jumpToCfi) return;
    if (jumpToCfi.startsWith('spine:')) {
      const idx = parseInt(jumpToCfi.replace('spine:', ''), 10);
      if (!isNaN(idx)) renderChapter(idx);
    }
    onJumpCfiHandled?.();
  }, [jumpToCfi]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    const next = spineIndex + 1;
    if (next < spineRef.current.length) renderChapter(next);
  }, [spineIndex, renderChapter]);

  const goPrev = useCallback(() => {
    const prev = spineIndex - 1;
    if (prev >= 0) renderChapter(prev);
  }, [spineIndex, renderChapter]);

  const swipeHandlers = useSwipe({ onSwipeLeft: goNext, onSwipeRight: goPrev, threshold: 40, maxVertical: 100 });

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--df-bg)' }}>
        <div className="text-center max-w-xs">
          <p className="text-4xl mb-4">📖</p>
          <p className="text-sm font-semibold text-white mb-2">Cannot open EPUB</p>
          <p className="text-xs" style={{ color: 'var(--df-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#fff' }}>
      <div className="flex-1 relative overflow-hidden" {...swipeHandlers}>

        {/* Prev page tap zone */}
        <button onClick={goPrev} disabled={spineIndex <= 0}
          className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
          aria-label="Previous chapter">
          <div className="rounded-r-xl h-20 w-8 flex items-center justify-center text-white text-xl"
            style={{ background: 'rgba(79,110,247,0.8)' }}>‹</div>
        </button>

        {/* Next page tap zone */}
        <button onClick={goNext} disabled={spineIndex >= spineRef.current.length - 1}
          className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
          aria-label="Next chapter">
          <div className="rounded-l-xl h-20 w-8 flex items-center justify-center text-white text-xl"
            style={{ background: 'rgba(79,110,247,0.8)' }}>›</div>
        </button>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: '#fff' }}>
            <p className="text-sm animate-pulse" style={{ color: 'var(--df-muted)' }}>Loading chapter…</p>
          </div>
        )}

        {/* Plain iframe with no sandbox — we control the src */}
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="EPUB chapter"
          onLoad={() => {
            setLoading(false);
            // Send any pre-existing highlights for this chapter into the iframe
            const hl = (chapterHighlightsRef.current ?? []).filter(h => h.spineIndex === spineIndex);
            if (hl.length && iframeRef.current?.contentWindow) {
              // Small delay to let the iframe script initialize
              setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'apply-highlights', highlights: hl }, '*'
                );
              }, 100);
            }
          }}
        />

        {/* TOC overlay */}
        {showToc && (
          <div className="absolute inset-0 z-30 flex flex-col" style={{ background: 'var(--df-surface)' }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--df-border)' }}>
              <span className="font-semibold text-sm text-white">Table of contents</span>
              <button onClick={() => setShowToc(false)}
                style={{ color: 'var(--df-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {toc.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: 'var(--df-muted)' }}>No table of contents.</p>
              )}
              {toc.map((item, i) => (
                <button key={i}
                  onClick={() => {
                    const hrefBase = (item.href.split('#')[0]) ?? item.href;
                    const idx = spineRef.current.findIndex(s =>
                      s.href === hrefBase || s.href.endsWith('/' + hrefBase) || hrefBase.endsWith('/' + s.href)
                    );
                    if (idx !== -1) renderChapter(idx);
                    setShowToc(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm transition-colors"
                  style={{ borderBottom: '1px solid var(--df-border)', color: 'var(--df-text)',
                    background: 'none', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid',
                    borderBottomColor: 'var(--df-border)', cursor: 'pointer' }}>
                  {item.label.trim()}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none md:hidden opacity-50"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          swipe to turn chapter
        </div>
      </div>

      {/* Highlight popup */}
      {selection && onHighlight && (
        <HighlightPopup
          text={selection.text}
          x={selection.x}
          y={selection.y}
          onSave={(color, note) => {
            onHighlight(selection.text, color, note);
            setSelection(null);
          }}
          onDismiss={() => setSelection(null)}
        />
      )}

      {/* Bottom strip */}
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 shrink-0"
        style={{ background: 'var(--df-surface2)', borderTop: '1px solid var(--df-border)' }}>
        <span className="text-[10px] mr-auto" style={{ color: 'var(--df-muted)' }}>
          {spineRef.current.length > 0 ? `Chapter ${spineIndex + 1} / ${spineRef.current.length}` : ''} · {progress}% read
        </span>
        <button onClick={() => setFontSize(s => Math.max(70, s - 10))}
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}
          title="Smaller text">A-</button>
        <button onClick={() => setFontSize(s => Math.min(200, s + 10))}
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--df-border)', color: 'var(--df-muted)', border: 'none', cursor: 'pointer' }}
          title="Larger text">A+</button>
      </div>
    </div>
  );
}
