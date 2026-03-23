import { pdfjs } from 'react-pdf';
import JSZip from 'jszip';

// Always set worker — must happen before any getDocument() call.
// Use the same CDN URL as PdfReader.tsx.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface BookMeta {
  pageCount: number;
  coverDataUrl: string | null; // base64 data URL
}

// ── PDF ────────────────────────────────────────────────────────────────────────
export async function extractPdfMeta(file: File): Promise<BookMeta> {
  const arrayBuffer = await file.arrayBuffer();

  // Use a typed array copy so pdfjs owns the buffer
  const data = new Uint8Array(arrayBuffer);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = pdf.numPages;

  let coverDataUrl: string | null = null;
  try {
    const page = await pdf.getPage(1);
    // Render at a size that gives a decent thumbnail (~200px wide)
    const nativeVp = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 200 / nativeVp.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      // Fill white background (PDFs may be transparent)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx as CanvasRenderingContext2D, viewport }).promise;
      coverDataUrl = canvas.toDataURL('image/jpeg', 0.80);
    }
  } catch (e) {
    console.warn('[extractPdfMeta] Cover render failed:', e);
  }

  return { pageCount, coverDataUrl };
}

// ── EPUB ───────────────────────────────────────────────────────────────────────
export async function extractEpubMeta(file: File): Promise<BookMeta> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Parse container.xml to find OPF path
  let opfPath = '';
  try {
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (containerXml) {
      const match = containerXml.match(/full-path=["']([^"']+\.opf)["']/i);
      if (match?.[1]) opfPath = match[1];
    }
  } catch { /* ignore */ }

  let pageCount = 0;
  let coverDataUrl: string | null = null;

  if (opfPath) {
    try {
      const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
      const opfXml = await zip.file(opfPath)?.async('string') ?? '';

      // Count spine items for approximate page count
      const spineMatches = [...opfXml.matchAll(/<itemref[^>]+idref=["']([^"']+)["']/g)];
      pageCount = spineMatches.length;

      // Find cover image — check meta cover hint first
      const coverMetaMatch = opfXml.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i)
        ?? opfXml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']cover["']/i);

      let coverHref: string | null = null;

      if (coverMetaMatch?.[1]) {
        const coverId = coverMetaMatch[1];
        const itemMatch = opfXml.match(new RegExp(`<item[^>]+id=["']${coverId}["'][^>]+href=["']([^"']+)["']`, 'i'))
          ?? opfXml.match(new RegExp(`<item[^>]+href=["']([^"']+)["'][^>]+id=["']${coverId}["']`, 'i'));
        if (itemMatch?.[1]) coverHref = itemMatch[1];
      }

      // Fallback: look for item with media-type image/* and id/href containing 'cover'
      if (!coverHref) {
        const imgMatch = opfXml.match(/<item[^>]+media-type=["']image\/[^"']+["'][^>]+href=["']([^"']+)["'][^>]*>/gi);
        if (imgMatch) {
          for (const m of imgMatch) {
            const hrefMatch = m.match(/href=["']([^"']+)["']/i);
            if (hrefMatch?.[1] && /cover/i.test(m)) { coverHref = hrefMatch[1]; break; }
          }
          // If still none, use first image
          if (!coverHref && imgMatch[0]) {
            coverHref = imgMatch[0].match(/href=["']([^"']+)["']/i)?.[1] ?? null;
          }
        }
      }

      if (coverHref) {
        const fullPath = opfDir + coverHref;
        const imgEntry = zip.file(fullPath) ?? zip.file(coverHref);
        if (imgEntry) {
          const buf = await imgEntry.async('arraybuffer');
          const ext = coverHref.split('.').pop()?.toLowerCase() ?? 'jpg';
          const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          const blob = new Blob([buf], { type: mime });
          coverDataUrl = await new Promise<string>(res => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (e) {
      console.warn('EPUB meta extraction failed:', e);
    }
  }

  return { pageCount: pageCount || 0, coverDataUrl };
}
