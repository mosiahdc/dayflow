/**
 * Decodes book filenames into { title, author }.
 *
 * Handles:
 *  1. OceanofPDF pattern:
 *     _OceanofPDF.com_Before_the_Coffee_Gets_Cold_1_-_Toshikazu_Kawaguchi
 *     → title: "Before the Coffee Gets Cold 1"
 *     → author: "Toshikazu Kawaguchi"
 *
 *  2. Plain underscored filenames:
 *     The_Great_Gatsby_F_Scott_Fitzgerald
 *     → title: "The Great Gatsby" (best-effort)
 *     → author: ""
 *
 *  3. Normal filenames: returned as-is.
 */
export interface ParsedBook {
  title: string;
  author: string;
}

// Words that should stay lowercase in title case (unless first word)
const LOWER_WORDS = new Set([
  'a','an','the','and','but','or','nor','for','so','yet',
  'at','by','in','of','on','to','up','as','it','is',
]);

function toTitleCase(words: string[]): string {
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      // Always capitalise first and last word, and words not in the lower list
      if (i === 0 || i === words.length - 1 || !LOWER_WORDS.has(lower)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return lower;
    })
    .join(' ');
}

export function parseBookFilename(rawName: string): ParsedBook {
  // Strip file extension
  const name = rawName.replace(/\.(pdf|epub)$/i, '').trim();

  // ── OceanofPDF pattern ──────────────────────────────────────────────────────
  // Starts with _OceanofPDF.com_ (case-insensitive, any variant like OceanPDF etc.)
  const oceanMatch = name.match(/^_[^_]*oceanofpdf[^_]*_(.+)$/i);
  if (oceanMatch) {
    const rest = oceanMatch[1]; // e.g. "Before_the_Coffee_Gets_Cold_1_-_Toshikazu_Kawaguchi"

    // Split on " - " or "_-_" separator between title and author
    const sepMatch = rest.match(/^(.+?)(?:_-_|-\s+|\s+-\s+)(.+)$/);
    if (sepMatch) {
      const titlePart  = sepMatch[1].replace(/_/g, ' ').trim();
      const authorPart = sepMatch[2].replace(/_/g, ' ').trim();

      const titleWords  = titlePart.split(/\s+/);
      const authorWords = authorPart.split(/\s+/);

      return {
        title:  toTitleCase(titleWords),
        author: toTitleCase(authorWords),
      };
    }

    // No separator found — treat whole rest as title
    const titleWords = rest.replace(/_/g, ' ').trim().split(/\s+/);
    return { title: toTitleCase(titleWords), author: '' };
  }

  // ── Generic underscore pattern ──────────────────────────────────────────────
  if (name.includes('_')) {
    // Check for " - " or "_-_" separator
    const sepMatch = name.match(/^(.+?)(?:_-_|-\s+|\s+-\s+)(.+)$/);
    if (sepMatch) {
      const titleWords  = sepMatch[1].replace(/_/g, ' ').trim().split(/\s+/);
      const authorWords = sepMatch[2].replace(/_/g, ' ').trim().split(/\s+/);
      return {
        title:  toTitleCase(titleWords),
        author: toTitleCase(authorWords),
      };
    }
    // No separator — just clean up underscores as title
    const words = name.replace(/_/g, ' ').trim().split(/\s+/);
    return { title: toTitleCase(words), author: '' };
  }

  // ── Plain filename — return as-is (capitalise first letter) ─────────────────
  return {
    title: name.charAt(0).toUpperCase() + name.slice(1),
    author: '',
  };
}
