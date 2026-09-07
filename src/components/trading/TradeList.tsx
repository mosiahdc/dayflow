import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { useTradeStore, parseExnessRow } from '@/store/tradeStore';
import TradeForm from './TradeForm';
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
      {pnl.toFixed(4)}
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
  const { deleteTrade, addTrades, fetchTrades } = useTradeStore();
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
      await addTrades(valid, (done, total) => {
        setUploadMsg(`⏳ Importing… ${done}/${total}`);
      });
      await fetchTrades();
      setUploadMsg(
        `✅ Imported ${valid.length} Exness order${valid.length > 1 ? 's' : ''}. Same-entry orders are consolidated automatically.`
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

  return (
    <div className="flex flex-col gap-3">
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
          {/* Manual add */}
          <button
            onClick={() => setShowForm(true)}
            className="text-xs bg-brand-accent text-white px-3 py-1.5 rounded-lg font-semibold hover:opacity-90"
          >
            + Add Trade
          </button>
        </div>
      </div>

      {uploadMsg && (
        <p className="text-xs text-center py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
          {uploadMsg}
        </p>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
        {/* Header */}
        <div
          className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 grid text-xs font-semibold text-brand-muted border-b dark:border-gray-700"
          style={{ gridTemplateColumns: '1fr 80px 90px 90px 60px 80px 28px' }}
        >
          <span>Symbol / Time</span>
          <span className="text-center">Direction</span>
          <span className="text-right">Entry / Close</span>
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
              <div
                key={trade.id}
                className="px-3 py-2.5 grid items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                style={{ gridTemplateColumns: '1fr 80px 90px 90px 60px 80px 28px' }}
              >
                {/* Symbol + time */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-bold dark:text-white truncate">{trade.futures}</p>
                    {(trade.orderCount ?? 1) > 1 && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent shrink-0">
                        {trade.orderCount} orders
                      </span>
                    )}
                  </div>
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
                  <p className="text-[10px] text-brand-muted">{trade.avgClosePrice.toFixed(2)}</p>
                </div>

                {/* PNL */}
                <div className="flex justify-end">
                  <PnlBadge pnl={trade.realizedPnl} />
                </div>

                {/* Qty */}
                <div className="text-right text-xs dark:text-white">{trade.closingQty}</div>

                {/* Status */}
                <div className="text-right text-[10px] text-brand-muted truncate">
                  {trade.status}
                </div>

                {/* Delete */}
                <div className="flex justify-end">
                  {confirmDelete === trade.id ? (
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
