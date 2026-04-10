import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { useTradeStore, parseMexcRow } from '@/store/tradeStore';
import TradeForm from './TradeForm';
import type { Trade } from '@/store/tradeStore';

// Dynamically import xlsx — avoids bundle cost if user never uploads
async function parseXlsx(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs' as string);
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json(ws);
}

function PnlBadge({ pnl }: { pnl: number }) {
  const isPos = pnl > 0;
  const isNeg = pnl < 0;
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded
        ${isPos ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : isNeg ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
    >
      {isPos ? '+' : ''}{pnl.toFixed(4)}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === 'Long';
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded
        ${isLong ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}
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
      let rows: Record<string, unknown>[];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        rows = await parseXlsx(file);
      } else {
        setUploadMsg('❌ Only .xlsx / .xls files supported');
        return;
      }
      const parsed = rows.map(parseMexcRow).filter(Boolean) as ReturnType<typeof parseMexcRow>[];
      const valid = parsed.filter((r) => r !== null) as Exclude<ReturnType<typeof parseMexcRow>, null>[];
      if (valid.length === 0) {
        setUploadMsg('❌ No valid trades found. Check the file format.');
        return;
      }
      await addTrades(valid);
      await fetchTrades();
      setUploadMsg(`✅ Imported ${valid.length} trade${valid.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      setUploadMsg('❌ Failed to parse file');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const filtered = trades.filter((t) =>
    t.futures.toLowerCase().includes(search.toLowerCase())
  );

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
            {uploading ? '⏳ Uploading…' : '⬆ Upload MEXC File'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
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
        <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 grid text-xs font-semibold text-brand-muted border-b dark:border-gray-700"
          style={{ gridTemplateColumns: '1fr 80px 90px 90px 60px 80px 28px' }}>
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
            <p className="text-xs text-brand-muted mt-1">Upload a MEXC file or add trades manually.</p>
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
                  <p className="text-[10px] text-brand-muted">{trade.avgClosePrice.toFixed(2)}</p>
                </div>

                {/* PNL */}
                <div className="flex justify-end">
                  <PnlBadge pnl={trade.realizedPnl} />
                </div>

                {/* Qty */}
                <div className="text-right text-xs dark:text-white">{trade.closingQty}</div>

                {/* Status */}
                <div className="text-right text-[10px] text-brand-muted truncate">{trade.status}</div>

                {/* Delete */}
                <div className="flex justify-end">
                  {confirmDelete === trade.id ? (
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => { deleteTrade(trade.id); setConfirmDelete(null); }}
                        className="text-[10px] bg-red-500 text-white px-1 py-0.5 rounded font-semibold"
                      >Del</button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-0.5"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(trade.id)}
                      className="text-gray-300 hover:text-red-400 text-sm"
                    >×</button>
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
