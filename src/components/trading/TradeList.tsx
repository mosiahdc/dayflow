import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { useTradeStore, parseExnessRow } from '@/store/tradeStore';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import TradeForm from './TradeForm';
import TradeOrdersDropdown from './TradeOrdersDropdown';
import type { Trade } from '@/store/tradeStore';

// Exness exports trade history as CSV. Parse it locally so the importer works
// without the old SheetJS/XLS dependency and also handles quoted values.
function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t'];
  let best: ',' | ';' | '\t' = ',';
  let bestCount = -1;
  for (const delimiter of candidates) {
    const count = [...headerLine].filter((ch) => ch === delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimited(text: string, delimiter: ',' | ';' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

async function parseExnessCsv(file: File): Promise<Record<string, unknown>[]> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const firstNonEmpty = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const delimiter = detectDelimiter(firstNonEmpty);
  const matrix = parseDelimited(text, delimiter);
  if (matrix.length < 2) return [];

  const headers = matrix[0]!.map((header) => header.replace(/^\uFEFF/, '').trim());
  return matrix.slice(1).map((values) => {
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

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
      {pnl.toFixed(2)}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === 'Long';
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded
        ${
          isLong
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        }`}
    >
      {isLong ? '↑ Long' : '↓ Short'}
    </span>
  );
}

interface Props {
  trades: Trade[];
}

export default function TradeList({ trades }: Props) {
  const { deleteTrade, deleteTrades, deleteAllTrades, addTrades, fetchTrades } = useTradeStore();
  const { importExnessNullCompensations, deleteExnessNullCompensations } = useTradeSettingsStore();
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTradeIds, setSelectedTradeIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setUploadMsg('❌ Only Exness .csv files are supported');
        return;
      }

      const rows = await parseExnessCsv(file);
      const parsed = rows.map(parseExnessRow).filter(Boolean) as ReturnType<typeof parseExnessRow>[];
      const valid = parsed.filter((r) => r !== null) as Exclude<
        ReturnType<typeof parseExnessRow>,
        null
      >[];
      if (valid.length === 0) {
        setUploadMsg('❌ No valid Exness trades found. Check that this is an Exness trade-history CSV.');
        return;
      }
      setUploadMsg(`⏳ Importing ${valid.length} Exness order${valid.length > 1 ? 's' : ''}…`);
      const tradeSummary = await addTrades(valid, (done, total) => {
        setUploadMsg(`⏳ Importing… ${done}/${total}`);
      });

      // The Exness CSV also contains the evidence needed to reconstruct D-NULL
      // (Null compensation): stop-out rows expose the negative account equity
      // that Exness then resets to zero. Import those adjustments alongside the
      // trade rows so DayFlow balance reconciles to the official statement.
      const nullSummary = await importExnessNullCompensations(rows);

      await fetchTrades();
      const nullText =
        nullSummary.detected > 0
          ? ` · Null compensation ${nullSummary.imported > 0 ? `+${nullSummary.importedTotal.toFixed(2)} (${nullSummary.imported} new)` : `already synced (${nullSummary.skippedDuplicates})`}`
          : '';
      const tradeText =
        tradeSummary.inserted > 0
          ? `Imported ${tradeSummary.inserted} new Exness order${tradeSummary.inserted === 1 ? '' : 's'}`
          : 'No new Exness orders';
      const duplicateText =
        tradeSummary.skippedDuplicates > 0
          ? ` · ${tradeSummary.skippedDuplicates} duplicate order${tradeSummary.skippedDuplicates === 1 ? '' : 's'} skipped`
          : '';
      setUploadMsg(
        `✅ ${tradeText}${duplicateText}${nullText}. Orders in the same opening-time batch are consolidated automatically.`
      );
    } catch (err) {
      console.error(err);
      setUploadMsg('❌ Failed to parse file');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const filtered = trades.filter((t) => t.futures.toLowerCase().includes(search.toLowerCase()));
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((trade) => selectedTradeIds.has(trade.id));

  const toggleTradeSelection = (id: string) => {
    setSelectedTradeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedTradeIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filtered.forEach((trade) => next.delete(trade.id));
      else filtered.forEach((trade) => next.add(trade.id));
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedTradeIds(new Set());
    setShowResetConfirm(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedTradeIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    setUploadMsg('');
    try {
      await deleteTrades([...selectedTradeIds]);
      setUploadMsg(`✅ Deleted ${selectedTradeIds.size} selected trade${selectedTradeIds.size === 1 ? '' : 's'} and all underlying Exness orders.`);
      setSelectedTradeIds(new Set());
    } catch (err) {
      console.error(err);
      setUploadMsg('❌ Bulk delete stopped because an error occurred. Refresh before trying again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleResetAllTrades = async () => {
    if (bulkDeleting) return;
    setBulkDeleting(true);
    setUploadMsg('');
    try {
      await deleteAllTrades();
      // D-NULL comes from the Exness trade-history CSV, so reset it together
      // with the trade history. Deposit/Withdrawal JSON history is retained.
      await deleteExnessNullCompensations();
      setUploadMsg('✅ Trade history reset. Trades and CSV-derived Null compensation were deleted. Deposits and withdrawals were kept.');
      exitBulkMode();
    } catch (err) {
      console.error(err);
      setUploadMsg('❌ Could not reset trade history.');
    } finally {
      setBulkDeleting(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <div className="df-trade-list flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="flex-1 min-w-32 border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="🔍 Search symbol…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 shrink-0">
          {/* Upload button */}
          <label className="cursor-pointer text-xs bg-brand-accent2 text-white px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center gap-1">
            {uploading ? '⏳ Importing…' : '⬆ Upload Exness CSV'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {/* Bulk delete / reset */}
          <button
            onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              bulkMode
                ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-white'
                : 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'
            }`}
          >
            {bulkMode ? '✕ Cancel Bulk' : '🗑 Bulk Delete'}
          </button>
          {/* Manual add */}
          <button
            onClick={() => setShowForm(true)}
            className="text-xs bg-brand-accent text-white px-3 py-1.5 rounded-lg font-semibold hover:opacity-90"
          >
            + Add Trade
          </button>
        </div>
      </div>

      {bulkMode && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="text-xs px-2.5 py-1 rounded border dark:border-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {allFilteredSelected ? '☑ Unselect filtered' : `☐ Select filtered (${filtered.length})`}
            </button>
            <button
              type="button"
              disabled={selectedTradeIds.size === 0 || bulkDeleting}
              onClick={handleDeleteSelected}
              className="text-xs px-2.5 py-1 rounded bg-red-500 text-white font-semibold disabled:opacity-40"
            >
              {bulkDeleting ? 'Deleting…' : `Delete selected (${selectedTradeIds.size})`}
            </button>
          </div>
          <button
            type="button"
            disabled={bulkDeleting || trades.length === 0}
            onClick={() => setShowResetConfirm(true)}
            className="text-xs px-2.5 py-1 rounded bg-red-700 text-white font-bold disabled:opacity-40"
          >
            Reset ALL trade history
          </button>
        </div>
      )}

      {showResetConfirm && (
        <div className="rounded-xl border border-red-500/40 bg-red-50 dark:bg-red-950/20 px-4 py-3">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">Reset all trades?</p>
          <p className="text-xs text-red-600/90 dark:text-red-300/80 mt-1">
            This permanently deletes every imported and manually-added trade for your account,
            including all underlying Exness orders and CSV-derived D-NULL / Null compensation.
            Exness deposit/withdrawal cash-flow records and your Initial Balance are not deleted.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleResetAllTrades}
              disabled={bulkDeleting}
              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
            >
              {bulkDeleting ? 'Resetting…' : 'Yes, delete all trades'}
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              disabled={bulkDeleting}
              className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-600 dark:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadMsg && (
        <p className="text-xs text-center py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
          {uploadMsg}
        </p>
      )}

      {/* Table */}
      <div className="df-trade-card overflow-hidden">
        {/* Header */}
        <div
          className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 grid text-xs font-semibold text-brand-muted border-b dark:border-gray-700"
          style={{
            gridTemplateColumns: bulkMode
              ? '32px 1fr 80px 90px 90px 60px 80px 28px'
              : '1fr 80px 90px 90px 60px 80px 28px',
          }}
        >
          {bulkMode && (
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
              aria-label="Select all filtered trades"
              className="df-checkbox"
            />
          )}
          <span>Symbol / Time</span>
          <span className="text-center">Direction</span>
          <span className="text-right">Avg Entry / Avg Exit</span>
          <span className="text-right">PNL</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Status</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-brand-muted">No trades yet.</p>
            <p className="text-xs text-brand-muted mt-1">
              Upload an Exness CSV or add trades manually.
            </p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700 max-h-[520px] overflow-y-auto">
            {filtered.map((trade) => (
              <div key={trade.id}>
                <div
                  className="px-3 py-2.5 grid items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  style={{
                    gridTemplateColumns: bulkMode
                      ? '32px 1fr 80px 90px 90px 60px 80px 28px'
                      : '1fr 80px 90px 90px 60px 80px 28px',
                  }}
                >
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={selectedTradeIds.has(trade.id)}
                    onChange={() => toggleTradeSelection(trade.id)}
                    aria-label={`Select ${trade.futures} trade`}
                    className="df-checkbox"
                  />
                )}
                {/* Symbol + time */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-bold dark:text-white truncate">{trade.futures}</p>
                    {(trade.orderCount ?? 1) > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTradeId((current) => (current === trade.id ? null : trade.id))
                        }
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 shrink-0 flex items-center gap-1"
                        title="Show all underlying Exness orders"
                      >
                        {trade.orderCount} orders
                        <span className="text-[8px]">{expandedTradeId === trade.id ? '▲' : '▼'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-muted tabular-nums">
                    {trade.openTime ? format(new Date(trade.openTime), 'MMM d, HH:mm') : '—'}
                    {trade.closeTime ? ` → ${format(new Date(trade.closeTime), 'HH:mm')}` : ''}
                  </p>
                </div>

                {/* Direction */}
                <div className="flex justify-center">
                  <DirectionBadge direction={trade.direction} />
                </div>

                {/* Avg Entry / Avg Exit */}
                <div className="text-right">
                  <p className="text-xs dark:text-white">{trade.avgEntryPrice.toFixed(2)}</p>
                  <p className="text-[10px] text-brand-muted">{trade.avgClosePrice.toFixed(2)}</p>
                </div>

                {/* PNL */}
                <div className="flex justify-end">
                  <PnlBadge pnl={trade.realizedPnl} />
                </div>

                {/* Qty */}
                <div className="text-right text-xs dark:text-white">{trade.closingQty.toFixed(2)}</div>

                {/* Status */}
                <div className="text-right text-[10px] text-brand-muted truncate">
                  {trade.status}
                </div>

                {/* Delete */}
                <div className="flex justify-end">
                  {bulkMode ? (
                    <span className="text-[10px] text-brand-muted">—</span>
                  ) : confirmDelete === trade.id ? (
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => {
                          deleteTrade(trade.id);
                          setConfirmDelete(null);
                        }}
                        className="text-[10px] bg-red-500 text-white px-1 py-0.5 rounded font-semibold"
                      >
                        Del
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(trade.id)}
                      className="text-gray-300 hover:text-red-400 text-sm"
                    >
                      ×
                    </button>
                  )}
                </div>
                </div>
                {expandedTradeId === trade.id && <TradeOrdersDropdown trade={trade} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade count */}
      {filtered.length > 0 && (
        <p className="text-xs text-brand-muted text-right">
          {filtered.length} trade{filtered.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      )}

      {showForm && <TradeForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
