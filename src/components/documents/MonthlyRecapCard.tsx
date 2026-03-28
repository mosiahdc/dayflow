/**
 * MonthlyRecapCard — generates a downloadable reading recap image
 * Pure frontend canvas rendering — no backend needed.
 * Import and render inside documents.tsx when user clicks "Monthly Recap".
 */
import { useRef, useEffect, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import type { Document } from '@/types';

interface Props {
  documents: Document[];
  onClose: () => void;
}

interface MonthStats {
  monthLabel: string;
  booksFinished: Document[];
  totalPages: number;
  topAuthor: string | null;
  avgDays: number | null;
}

function getStats(documents: Document[], monthDate: Date): MonthStats {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const monthLabel = format(monthDate, 'MMMM yyyy');

  const booksFinished = documents.filter(d => {
    if (d.status !== 'finished' || !d.finishedAt) return false;
    try {
      return isWithinInterval(parseISO(d.finishedAt), { start, end });
    } catch { return false; }
  });

  const totalPages = booksFinished.reduce((s, d) => s + (d.pageCount ?? 0), 0);

  // Top author
  const authorCounts: Record<string, number> = {};
  booksFinished.forEach(d => {
    if (d.author) authorCounts[d.author] = (authorCounts[d.author] ?? 0) + 1;
  });
  const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Avg days to finish
  const durations = booksFinished
    .filter(d => d.startedAt && d.finishedAt)
    .map(d => {
      try {
        return Math.abs((parseISO(d.finishedAt!).getTime() - parseISO(d.startedAt!).getTime()) / 86400000);
      } catch { return null; }
    })
    .filter((n): n is number => n !== null);

  const avgDays = durations.length > 0 ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : null;

  return { monthLabel, booksFinished, totalPages, topAuthor, avgDays };
}

function drawCard(canvas: HTMLCanvasElement, stats: MonthStats) {
  const W = 900, H = 500;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#12121f');
  bg.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Accent bar top
  const accent = ctx.createLinearGradient(0, 0, W, 0);
  accent.addColorStop(0, '#4F6EF7');
  accent.addColorStop(1, '#7C3AED');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 5);

  // Decorative circle
  ctx.beginPath();
  ctx.arc(W - 80, H - 60, 200, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(79,110,247,0.04)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 80, H - 60, 130, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(124,58,237,0.05)';
  ctx.fill();

  // DayFlow logo
  ctx.font = '700 13px system-ui';
  ctx.fillStyle = '#4F6EF7';
  ctx.fillText('DAYFLOW', 44, 50);

  // Month label
  ctx.font = '300 38px system-ui';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(stats.monthLabel, 44, 105);

  // Subtitle
  ctx.font = '400 14px system-ui';
  ctx.fillStyle = '#888899';
  ctx.fillText('Monthly Reading Recap', 44, 130);

  // Divider
  ctx.strokeStyle = '#2d2d4e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, 150);
  ctx.lineTo(W - 44, 150);
  ctx.stroke();

  // Stats grid — 4 boxes
  const stats4 = [
    { label: 'Books Finished', value: String(stats.booksFinished.length), color: '#4F6EF7' },
    { label: 'Pages Read', value: stats.totalPages > 0 ? stats.totalPages.toLocaleString() : '—', color: '#10B981' },
    { label: 'Top Author', value: stats.topAuthor ?? '—', color: '#F59E0B' },
    { label: 'Avg Days / Book', value: stats.avgDays !== null ? `${stats.avgDays}d` : '—', color: '#EC4899' },
  ];

  const boxW = (W - 88 - 30) / 4;
  stats4.forEach((s, i) => {
    const x = 44 + i * (boxW + 10);
    const y = 170;

    // Box bg
    ctx.fillStyle = '#1e1e3a';
    ctx.strokeStyle = '#2d2d4e';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, boxW, 90, 10);
    ctx.fill();
    ctx.stroke();

    // Value
    const valFontSize = s.value.length > 8 ? 18 : 26;
    ctx.font = `700 ${valFontSize}px system-ui`;
    ctx.fillStyle = s.color;
    ctx.fillText(truncate(s.value, 12), x + 14, y + 42);

    // Label
    ctx.font = '400 11px system-ui';
    ctx.fillStyle = '#888899';
    ctx.fillText(s.label, x + 14, y + 64);
  });

  // Book list
  const listY = 295;
  ctx.font = '600 12px system-ui';
  ctx.fillStyle = '#888899';
  ctx.fillText('BOOKS THIS MONTH', 44, listY);

  if (stats.booksFinished.length === 0) {
    ctx.font = '400 14px system-ui';
    ctx.fillStyle = '#888899';
    ctx.fillText('No books finished this month.', 44, listY + 26);
  } else {
    const showBooks = stats.booksFinished.slice(0, 5);
    showBooks.forEach((book, i) => {
      const by = listY + 22 + i * 28;
      const colors = ['#4F6EF7', '#10B981', '#F59E0B', '#EC4899', '#7C3AED'];
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.beginPath();
      ctx.arc(52, by + 6, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '500 13px system-ui';
      ctx.fillStyle = '#e8e8f0';
      ctx.fillText(truncate(book.title, 42), 65, by + 10);

      if (book.author) {
        ctx.font = '400 11px system-ui';
        ctx.fillStyle = '#888899';
        ctx.fillText(truncate(book.author, 30), 65, by + 24);
      }

      if (book.finishedAt) {
        ctx.font = '400 11px system-ui';
        ctx.fillStyle = '#2d2d4e';
        const dateStr = format(parseISO(book.finishedAt), 'MMM d');
        ctx.fillText(dateStr, W - 90, by + 10);
      }
    });
    if (stats.booksFinished.length > 5) {
      ctx.font = '400 12px system-ui';
      ctx.fillStyle = '#888899';
      ctx.fillText(`+${stats.booksFinished.length - 5} more`, 44, listY + 22 + 5 * 28);
    }
  }

  // Footer
  ctx.font = '400 11px system-ui';
  ctx.fillStyle = '#2d2d4e';
  ctx.fillText('dayflow.app', W - 44 - 80, H - 20);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function MonthlyRecapCard({ documents, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0=this month, -1=last month…

  const targetMonth = new Date();
  targetMonth.setMonth(targetMonth.getMonth() + monthOffset);
  const stats = getStats(documents, targetMonth);

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, stats);
  }, [stats]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `reading-recap-${format(targetMonth, 'yyyy-MM')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 60,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  };
  const modal: React.CSSProperties = {
    background: '#1a1a2e', border: '1px solid #2d2d4e',
    borderRadius: 16, padding: 20, maxWidth: 700, width: '100%',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setMonthOffset(o => o - 1)}
              style={{ background: '#1e1e3a', border: '1px solid #2d2d4e', borderRadius: 8, padding: '6px 12px', color: '#888899', cursor: 'pointer', fontSize: 14 }}
            >←</button>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f0', minWidth: 130, textAlign: 'center' }}>
              {stats.monthLabel}
            </span>
            <button
              onClick={() => setMonthOffset(o => Math.min(0, o + 1))}
              style={{ background: '#1e1e3a', border: '1px solid #2d2d4e', borderRadius: 8, padding: '6px 12px', color: monthOffset < 0 ? '#888899' : '#2d2d4e', cursor: monthOffset < 0 ? 'pointer' : 'default', fontSize: 14 }}
              disabled={monthOffset >= 0}
            >→</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDownload}
              style={{ background: '#4F6EF7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
            >
              ⬇ Download PNG
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', color: '#888899', border: '1px solid #2d2d4e', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Canvas preview */}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', borderRadius: 10, display: 'block', border: '1px solid #2d2d4e' }}
        />

        <p style={{ fontSize: 11, color: '#888899', marginTop: 10, textAlign: 'center' }}>
          Screenshot or download the image to share your reading recap
        </p>
      </div>
    </div>
  );
}
