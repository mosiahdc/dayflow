import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useEffect } from 'react';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import { useTradeNotesStore } from '@/store/tradeNotesStore';
import type { Trade } from '@/store/tradeStore';

const PROJECT_START = '2026-04-12 08:00:00';
const MAX_TRADES_PER_DAY = 5;

type MarginMode = 'Low' | 'Normal' | 'Hype' | 'Volatile';
const MARGIN_DIVISORS: Record<MarginMode, number> = {
  Low: 0.18,
  Normal: 0.3,
  Hype: 0.7,
  Volatile: 1,
};

// ── Shared badges ─────────────────────────────────────────────────────────────

function PnlBadge({ pnl }: { pnl: number }) {
  const isPos = pnl > 0;
  const isNeg = pnl < 0;
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded
      ${
        isPos
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : isNeg
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
      }`}
    >
      {isPos ? '+' : ''}
      {pnl.toFixed(4)}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded
      ${
        direction === 'Long'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      {direction === 'Long' ? '↑ Long' : '↓ Short'}
    </span>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 shadow-sm
      ${
        highlight
          ? 'bg-brand-accent/5 border-brand-accent/30 dark:bg-brand-accent/10'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      {children}
    </div>
  );
}

// ── Notes cell ────────────────────────────────────────────────────────────────

function NotesCell({ tradeId }: { tradeId: string }) {
  const { getNote, setNote } = useTradeNotesStore();
  const note = getNote(tradeId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleOpen = () => {
    setDraft(note.notes);
    setOpen(true);
  };
  const handleSave = () => {
    setNote(tradeId, 'notes', draft.trim());
    setOpen(false);
  };

  if (open) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 w-full max-w-sm flex flex-col gap-3">
          <h3 className="font-bold text-sm dark:text-white">Trade Notes</h3>
          <textarea
            autoFocus
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add your notes and reflections…"
            className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-brand-accent text-white rounded-lg py-2 text-sm font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      title={note.notes || 'Add notes'}
      className={`w-full h-full flex items-center justify-center rounded transition-colors
        ${
          note.notes
            ? 'text-brand-accent hover:text-brand-accent/70'
            : 'text-gray-300 hover:text-brand-accent dark:text-gray-600 dark:hover:text-brand-accent'
        }`}
    >
      {note.notes ? (
        <span className="text-xs max-w-[80px] truncate text-left">{note.notes}</span>
      ) : (
        <span className="text-base">📝</span>
      )}
    </button>
  );
}

// ── Video cell ────────────────────────────────────────────────────────────────

function VideoCell({ tradeId }: { tradeId: string }) {
  const { getNote, setNote } = useTradeNotesStore();
  const note = getNote(tradeId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleOpen = () => {
    setDraft(note.videoUrl);
    setOpen(true);
  };
  const handleSave = () => {
    setNote(tradeId, 'videoUrl', draft.trim());
    setOpen(false);
  };

  const openVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(note.videoUrl, '_blank', 'noreferrer');
  };

  if (open) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 w-full max-w-sm flex flex-col gap-3">
          <h3 className="font-bold text-sm dark:text-white">Video Review Link</h3>
          <input
            autoFocus
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="https://youtube.com/watch?v=…"
            className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-brand-accent text-white rounded-lg py-2 text-sm font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {note.videoUrl ? (
        <>
          <button
            onClick={openVideo}
            title="Open video"
            className="text-base hover:scale-110 transition-transform"
          >
            🎬
          </button>
          <button
            onClick={handleOpen}
            title="Edit link"
            className="text-[10px] text-brand-muted hover:text-brand-accent"
          >
            ✏️
          </button>
        </>
      ) : (
        <button
          onClick={handleOpen}
          title="Add video review link"
          className="text-gray-300 hover:text-brand-accent dark:text-gray-600 dark:hover:text-brand-accent transition-colors text-base"
        >
          🎬
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  trades: Trade[];
}

export default function ProjectDiscipline({ trades }: Props) {
  const { initialBalance } = useTradeSettingsStore();
  const { getNote, setNote, fetchNotes } = useTradeNotesStore();
  const [marginMode, setMarginMode] = useState<MarginMode>('Normal');
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const projectTrades = useMemo(() => trades.filter((t) => t.closeTime >= PROJECT_START), [trades]);

  // Daily summary — all days EXCEPT the latest trading date (still in progress)
  const dailySummary = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    for (const t of projectTrades) {
      const d = t.closeTime.slice(0, 10);
      if (!map.has(d)) map.set(d, { pnl: 0, count: 0 });
      const s = map.get(d)!;
      s.pnl += t.realizedPnl;
      s.count += 1;
    }
    const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    // The first entry after sorting desc is the latest trading date — exclude it
    const latestDate = sorted[0]?.[0] ?? null;
    return sorted
      .filter(([date]) => date !== latestDate)
      .map(([date, stats]) => ({ date, ...stats }));
  }, [projectTrades]);

  // Balance = initial + PNL only from completed days (5 trades)
  const projectPnl = useMemo(() => dailySummary.reduce((sum, d) => sum + d.pnl, 0), [dailySummary]);
  const balance = initialBalance + projectPnl;

  const positionMargin = balance > 0 ? (balance * 0.01) / MARGIN_DIVISORS[marginMode] : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(positionMargin.toFixed(4));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Visible trades in middle pane
  const visibleTrades = useMemo(() => {
    const base = selectedDate
      ? projectTrades.filter((t) => t.closeTime.slice(0, 10) === selectedDate)
      : projectTrades;
    return [...base].sort((a, b) => b.closeTime.localeCompare(a.closeTime));
  }, [projectTrades, selectedDate]);

  const visiblePnl = visibleTrades.reduce((s, t) => s + t.realizedPnl, 0);
  const visibleWins = visibleTrades.filter((t) => t.realizedPnl > 0).length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Row 1: Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Balance">
          <p
            className={`text-xl font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
          >
            {balance >= 0 ? '' : '-'}
            {Math.abs(balance).toFixed(4)}
            <span className="text-xs font-normal text-brand-muted ml-1">USDT</span>
          </p>
          {initialBalance > 0 && (
            <p className="text-[10px] text-brand-muted">
              Initial {initialBalance.toFixed(2)} + PNL {projectPnl >= 0 ? '+' : ''}
              {projectPnl.toFixed(4)}
            </p>
          )}
          {initialBalance === 0 && (
            <p className="text-[10px] text-amber-500">Set initial balance in ⚙️ Settings</p>
          )}
        </StatBox>

        <StatBox label="Max Trades / Day">
          <p className="text-xl font-bold dark:text-white">{MAX_TRADES_PER_DAY}</p>
          <p className="text-[10px] text-brand-muted">Discipline limit</p>
        </StatBox>

        <StatBox label="Position Margin" highlight>
          <div className="flex items-center gap-2 mb-1">
            <select
              value={marginMode}
              onChange={(e) => setMarginMode(e.target.value as MarginMode)}
              className="text-xs border rounded px-2 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600 flex-1"
            >
              {(Object.keys(MARGIN_DIVISORS) as MarginMode[]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-brand-accent flex-1 truncate">
              {positionMargin > 0 ? positionMargin.toFixed(4) : '—'}
              {positionMargin > 0 && (
                <span className="text-xs font-normal text-brand-muted ml-1">USDT</span>
              )}
            </p>
            <button
              onClick={handleCopy}
              disabled={positionMargin === 0}
              title="Copy to clipboard"
              className={`text-xs px-2 py-1 rounded font-semibold transition-all shrink-0
                ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-brand-muted hover:bg-brand-accent hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
            >
              {copied ? '✓' : '⎘'}
            </button>
          </div>
          <p className="text-[10px] text-brand-muted">
            (Balance × 1%) ÷ {MARGIN_DIVISORS[marginMode]}
          </p>
        </StatBox>
      </div>

      {/* ── Row 2: Sidebar + Trade log ───────────────────────────────────── */}
      <div className="flex gap-4" style={{ minHeight: '520px' }}>
        {/* Left sidebar */}
        <div className="w-48 shrink-0 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted px-1">
            Daily Summary
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow overflow-hidden flex-1">
            {dailySummary.length === 0 ? (
              <p className="text-xs text-brand-muted text-center py-8 px-3">
                No completed days yet.
              </p>
            ) : (
              <div
                className="divide-y dark:divide-gray-700 overflow-y-auto"
                style={{ maxHeight: '480px' }}
              >
                {dailySummary.map(({ date, pnl, count }) => {
                  const isSelected = selectedDate === date;
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(isSelected ? null : date)}
                      className={`w-full text-left px-3 py-2.5 flex justify-between items-center transition-colors
                        ${
                          isSelected
                            ? 'bg-brand-accent/10 dark:bg-brand-accent/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                        }`}
                    >
                      <div>
                        <p className="text-xs font-semibold dark:text-white">
                          {format(parseISO(date), 'MMM d')}
                        </p>
                        <p className="text-[10px] text-brand-muted">{count} trades</p>
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                      >
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(3)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Middle — trade log */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              {selectedDate
                ? `Trade Log — ${format(parseISO(selectedDate), 'MMM d, yyyy')}`
                : `Project Trade Log (from ${format(parseISO(PROJECT_START.slice(0, 10)), 'MMM d, yyyy')})`}
            </p>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-xs text-brand-accent hover:underline"
              >
                Show all ×
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow overflow-hidden flex-1">
            {/* Table header */}
            <div
              className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 grid text-xs font-semibold text-brand-muted border-b dark:border-gray-700"
              style={{ gridTemplateColumns: '36px 1fr 72px 90px 80px 50px 100px 80px' }}
            >
              <span className="text-center">#</span>
              <span>Symbol / Time</span>
              <span className="text-center">Dir</span>
              <span className="text-right">Entry / Close</span>
              <span className="text-right">PNL</span>
              <span className="text-right">Qty</span>
              <span className="text-center">Notes</span>
              <span className="text-center">Video</span>
            </div>

            {visibleTrades.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-sm text-brand-muted">No trades for this period.</p>
              </div>
            ) : (
              <div
                className="divide-y dark:divide-gray-700 overflow-y-auto"
                style={{ maxHeight: '460px' }}
              >
                {visibleTrades.map((trade, idx) => (
                  <div
                    key={trade.id}
                    className="px-3 py-2 grid items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    style={{ gridTemplateColumns: '36px 1fr 72px 90px 80px 50px 100px 80px' }}
                  >
                    {/* Trade # — 1 = oldest, counts up toward latest */}
                    <div className="flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-muted tabular-nums">
                        {visibleTrades.length - idx}
                      </span>
                    </div>

                    {/* Symbol + time */}
                    <div className="min-w-0">
                      <p className="text-sm font-bold dark:text-white truncate">{trade.futures}</p>
                      <p className="text-[10px] text-brand-muted">
                        {trade.closeTime ? format(new Date(trade.closeTime), 'MMM d, HH:mm') : '—'}
                      </p>
                    </div>

                    {/* Direction */}
                    <div className="flex justify-center">
                      <DirectionBadge direction={trade.direction} />
                    </div>

                    {/* Entry / Close */}
                    <div className="text-right">
                      <p className="text-xs dark:text-white">{trade.avgEntryPrice.toFixed(2)}</p>
                      <p className="text-[10px] text-brand-muted">
                        {trade.avgClosePrice.toFixed(2)}
                      </p>
                    </div>

                    {/* PNL */}
                    <div className="flex justify-end">
                      <PnlBadge pnl={trade.realizedPnl} />
                    </div>

                    {/* Qty */}
                    <div className="text-right text-xs dark:text-white">{trade.closingQty}</div>

                    {/* Notes */}
                    <div className="flex justify-center px-1">
                      <NotesCell tradeId={trade.id} />
                    </div>

                    {/* Video */}
                    <div className="flex justify-center">
                      <VideoCell tradeId={trade.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {visibleTrades.length > 0 && (
            <div className="flex gap-4 px-1 text-xs text-brand-muted flex-wrap">
              <span>
                {visibleTrades.length} trade{visibleTrades.length !== 1 ? 's' : ''}
              </span>
              <span>
                Net:{' '}
                <span
                  className={`font-bold ${visiblePnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                >
                  {visiblePnl >= 0 ? '+' : ''}
                  {visiblePnl.toFixed(4)} USDT
                </span>
              </span>
              <span>
                Win rate:{' '}
                <span className="font-bold dark:text-white">
                  {Math.round((visibleWins / visibleTrades.length) * 100)}%
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
