import { useMemo, useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import { useTradeNotesStore } from '@/store/tradeNotesStore';
import type { Trade } from '@/store/tradeStore';

const PROJECT_START = '2026-07-10 00:00:00';
const MAX_TRADES_PER_DAY = 5;

// UTC+8 offset helper — converts a UTC ISO string to UTC+8 display string
function toUTC8(isoString: string): string {
  const date = new Date(isoString);
  const utc8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return format(utc8, 'MMM d, HH:mm');
}

// Today's date in UTC+8
function todayUTC8(): string {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().slice(0, 10);
}

type MarginMode = 'Low' | 'Normal' | 'Hype' | 'Volatile';
const MARGIN_DIVISORS: Record<MarginMode, number> = {
  Low: 0.18,
  Normal: 0.3,
  Hype: 0.7,
  Volatile: 1,
};

type TxType = 'deposit' | 'withdrawal' | 'funding_fee';

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

function NotesCell({
  tradeId,
  getNote,
  setNote,
}: {
  tradeId: string;
  getNote: (id: string) => { notes: string; videoUrl: string; tradeId: string };
  setNote: (id: string, field: 'notes' | 'videoUrl', value: string) => Promise<void>;
}) {
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
        ${note.notes ? 'text-brand-accent hover:text-brand-accent/70' : 'text-gray-300 hover:text-brand-accent dark:text-gray-600 dark:hover:text-brand-accent'}`}
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

function VideoCell({
  tradeId,
  getNote,
  setNote,
}: {
  tradeId: string;
  getNote: (id: string) => { notes: string; videoUrl: string; tradeId: string };
  setNote: (id: string, field: 'notes' | 'videoUrl', value: string) => Promise<void>;
}) {
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

// ── TX type config ────────────────────────────────────────────────────────────

// TX_CONFIG — funding_fee sign depends on whether the amount is positive or negative
const TX_CONFIG: Record<TxType, { label: string; colorClass: string; badgeClass: string }> = {
  deposit: {
    label: 'Deposit',
    colorClass: 'text-green-600 dark:text-green-400',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  withdrawal: {
    label: 'Withdraw',
    colorClass: 'text-red-500 dark:text-red-400',
    badgeClass: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  },
  funding_fee: {
    label: 'Funding Fee',
    colorClass: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
};

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  trades: Trade[];
}

export default function ProjectDiscipline({ trades }: Props) {
  const { initialBalance, transactions, fetchSettings, addTransaction, deleteTransaction } =
    useTradeSettingsStore();
  const { getNote, setNote, fetchNotes } = useTradeNotesStore();
  const [marginMode, setMarginMode] = useState<MarginMode>('Normal');
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Transaction modal state
  const [txModal, setTxModal] = useState<TxType | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txSaving, setTxSaving] = useState(false);
  const [showTxHistory, setShowTxHistory] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchNotes();
  }, [fetchSettings, fetchNotes]);

  const projectTrades = useMemo(() => trades.filter((t) => t.closeTime >= PROJECT_START), [trades]);

  // Daily summary — exclude ONLY today (UTC+8) since it's still in progress.
  // All past days are completed and included.
  const today = todayUTC8();
  const dailySummary = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    for (const t of projectTrades) {
      const d = t.closeTime.slice(0, 10);
      if (!map.has(d)) map.set(d, { pnl: 0, count: 0 });
      const s = map.get(d)!;
      s.pnl += t.realizedPnl;
      s.count += 1;
    }
    return [...map.entries()]
      .filter(([date]) => date !== today) // exclude today — still in progress
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, stats]) => ({ date, ...stats }));
  }, [projectTrades, today]);

  // Net effect of all transactions — amount is already signed
  const txNet = useMemo(() => transactions.reduce((sum, t) => sum + t.amount, 0), [transactions]);

  // Balance = initial + tx net + completed-day PNL (excludes today)
  const projectPnl = useMemo(() => dailySummary.reduce((sum, d) => sum + d.pnl, 0), [dailySummary]);
  const balance = initialBalance + txNet + projectPnl;

  const positionMargin = balance > 0 ? (balance * 0.01) / MARGIN_DIVISORS[marginMode] : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(positionMargin.toFixed(4));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleTxSave = async () => {
    const amt = parseFloat(txAmount);
    if (!txModal || isNaN(amt) || amt === 0) return;
    setTxSaving(true);
    // deposit = +amt, withdrawal = -amt, funding_fee = signed as entered
    const signedAmount =
      txModal === 'deposit' ? Math.abs(amt) : txModal === 'withdrawal' ? -Math.abs(amt) : amt; // funding_fee: user enters positive or negative
    await addTransaction(txModal, signedAmount, txNote.trim());
    setTxAmount('');
    setTxNote('');
    setTxModal(null);
    setTxSaving(false);
  };

  // Visible trades — sorted newest first
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
        {/* Balance */}
        <StatBox label="Balance">
          <p
            className={`text-xl font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
          >
            {balance >= 0 ? '' : '-'}
            {Math.abs(balance).toFixed(4)}
            <span className="text-xs font-normal text-brand-muted ml-1">USDT</span>
          </p>
          <p className="text-[10px] text-brand-muted leading-relaxed">
            Initial {initialBalance.toFixed(2)}
            {txNet !== 0 && (
              <>
                {' '}
                · Tx {txNet >= 0 ? '+' : ''}
                {txNet.toFixed(4)}
              </>
            )}{' '}
            · PNL {projectPnl >= 0 ? '+' : ''}
            {projectPnl.toFixed(4)}
          </p>
          {initialBalance === 0 && (
            <p className="text-[10px] text-amber-500">Set initial balance in ⚙️ Settings</p>
          )}
          {/* Action buttons */}
          <div className="flex gap-1 mt-1.5 flex-wrap">
            <button
              onClick={() => {
                setTxModal('deposit');
                setTxAmount('');
                setTxNote('');
              }}
              className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              + Deposit
            </button>
            <button
              onClick={() => {
                setTxModal('withdrawal');
                setTxAmount('');
                setTxNote('');
              }}
              className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              − Withdraw
            </button>
            <button
              onClick={() => {
                setTxModal('funding_fee');
                setTxAmount('');
                setTxNote('');
              }}
              className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              ⚡ Fee
            </button>
            {transactions.length > 0 && (
              <button
                onClick={() => setShowTxHistory(!showTxHistory)}
                title="Transaction history"
                className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-brand-muted hover:text-brand-accent transition-colors"
              >
                📋
              </button>
            )}
          </div>
        </StatBox>

        {/* Weekly Parameters */}
        <StatBox label="Weekly Parameters">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-0.5">
            <div>
              <p className="text-[10px] text-brand-muted">Base margin (10%)</p>
              <p className="text-base font-bold text-brand-accent">${(balance * 0.1).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-brand-muted">Leverage</p>
              <p className="text-base font-bold dark:text-white">500×</p>
            </div>
            <div>
              <p className="text-[10px] text-brand-muted">TP target (+35% ROE)</p>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                +${(balance * 0.1 * 0.35).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-brand-muted">Hard SL (−100% ROE)</p>
              <p className="text-sm font-bold text-red-500 dark:text-red-400">
                −${(balance * 0.1).toFixed(2)}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-brand-muted mt-1">Max 3 trades · 1-loss circuit breaker</p>
        </StatBox>

        {/* Position Margin */}
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

      {/* ── Transaction history panel ────────────────────────────────────── */}
      {showTxHistory && transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-xs font-semibold dark:text-white">Transaction History</h3>
            <button
              onClick={() => setShowTxHistory(false)}
              className="text-brand-muted hover:text-brand-dark dark:hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          <div className="divide-y dark:divide-gray-700 max-h-56 overflow-y-auto">
            {transactions.map((tx) => {
              const cfg = TX_CONFIG[tx.type as TxType] ?? TX_CONFIG.deposit;
              const isPositive = tx.amount >= 0;
              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                    {tx.note && (
                      <span className="text-xs text-brand-muted truncate max-w-[140px]">
                        {tx.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                    >
                      {isPositive ? '+' : ''}
                      {tx.amount.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-brand-muted">{toUTC8(tx.createdAt)}</span>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-gray-300 hover:text-red-400 text-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Transaction modal ────────────────────────────────────────────── */}
      {txModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setTxModal(null)}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 w-full max-w-sm flex flex-col gap-3">
            <h3 className="font-bold text-sm dark:text-white">{TX_CONFIG[txModal].label}</h3>
            {txModal === 'funding_fee' && (
              <p className="text-xs text-brand-muted -mt-1">
                Enter positive to receive, negative to pay (e.g. -0.012)
              </p>
            )}
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Amount (USDT)</label>
              <input
                autoFocus
                type="number"
                min={txModal === 'funding_fee' ? undefined : '0'}
                step="0.0001"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTxSave()}
                placeholder={txModal === 'funding_fee' ? 'e.g. 0.05 or -0.012' : '0.0000'}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Note (optional)</label>
              <input
                type="text"
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTxSave()}
                placeholder={
                  txModal === 'funding_fee'
                    ? 'e.g. Apr 14 funding'
                    : txModal === 'deposit'
                      ? 'e.g. Weekly top-up'
                      : 'e.g. Profit taking'
                }
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTxModal(null)}
                className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleTxSave}
                disabled={txSaving || txAmount === '' || txAmount === '0'}
                className={`flex-1 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50
                  ${
                    txModal === 'deposit'
                      ? 'bg-green-500 hover:bg-green-600'
                      : txModal === 'funding_fee'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-red-500 hover:bg-red-600'
                  }`}
              >
                {txSaving ? 'Saving…' : TX_CONFIG[txModal].label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 2: Sidebar + Trade log ───────────────────────────────────── */}
      <div className="flex gap-4" style={{ minHeight: '520px' }}>
        {/* Left sidebar — daily summary */}
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
                        ${isSelected ? 'bg-brand-accent/10 dark:bg-brand-accent/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
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
                    <div className="flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-muted tabular-nums">
                        {visibleTrades.length - idx}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold dark:text-white truncate">{trade.futures}</p>
                      <p className="text-[10px] text-brand-muted">
                        {trade.closeTime ? format(new Date(trade.closeTime), 'MMM d, HH:mm') : '—'}
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <DirectionBadge direction={trade.direction} />
                    </div>
                    <div className="text-right">
                      <p className="text-xs dark:text-white">{trade.avgEntryPrice.toFixed(2)}</p>
                      <p className="text-[10px] text-brand-muted">
                        {trade.avgClosePrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <PnlBadge pnl={trade.realizedPnl} />
                    </div>
                    <div className="text-right text-xs dark:text-white">{trade.closingQty}</div>
                    <div className="flex justify-center px-1">
                      <NotesCell tradeId={trade.id} getNote={getNote} setNote={setNote} />
                    </div>
                    <div className="flex justify-center">
                      <VideoCell tradeId={trade.id} getNote={getNote} setNote={setNote} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
