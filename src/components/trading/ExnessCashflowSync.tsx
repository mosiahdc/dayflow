import { useState } from 'react';
import {
  useTradeSettingsStore,
  type ExnessTransactionImportSummary,
} from '@/store/tradeSettingsStore';

interface Props {
  onClose: () => void;
}

function SummaryCard({ summary }: { summary: ExnessTransactionImportSummary }) {
  const netPositive = summary.importedNet >= 0;
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-900/15">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Exness cash flow synced
          </p>
          <p className="mt-0.5 text-[11px] text-green-700/80 dark:text-green-400/80">
            {summary.imported} new transaction{summary.imported === 1 ? '' : 's'} saved
            {summary.skippedDuplicates > 0
              ? ` · ${summary.skippedDuplicates} duplicate${summary.skippedDuplicates === 1 ? '' : 's'} skipped`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-brand-muted">Imported net</p>
          <p
            className={`text-base font-bold tabular-nums ${netPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
          >
            {netPositive ? '+' : ''}${summary.importedNet.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/70 px-2 py-1.5 dark:bg-gray-800/50">
          <p className="text-brand-muted">Deposits</p>
          <p className="font-bold text-green-600 dark:text-green-400">{summary.deposits}</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-1.5 dark:bg-gray-800/50">
          <p className="text-brand-muted">Withdrawals</p>
          <p className="font-bold text-red-500 dark:text-red-400">{summary.withdrawals}</p>
        </div>
      </div>
      {summary.skippedInvalid > 0 && (
        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
          {summary.skippedInvalid} item{summary.skippedInvalid === 1 ? '' : 's'} could not be imported.
        </p>
      )}
    </div>
  );
}

export default function ExnessCashflowSync({ onClose }: Props) {
  const importExnessTransactions = useTradeSettingsStore((s) => s.importExnessTransactions);
  const [rawJson, setRawJson] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ExnessTransactionImportSummary | null>(null);

  const runSync = async (text: string) => {
    if (!text.trim() || syncing) return;
    setSyncing(true);
    setError('');
    setSummary(null);
    try {
      const result = await importExnessTransactions(text);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import Exness transaction history.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text');
    if (!text) return;
    event.preventDefault();
    setRawJson(text);
    void runSync(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="df-modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
        <div className="flex items-start justify-between border-b px-5 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-base font-bold dark:text-white">Sync Exness cash flow</h3>
            <p className="mt-1 text-xs text-brand-muted">
              Paste the JSON from Exness Transaction history. Deposit and Withdrawal entries with Done or Sent status are saved automatically. D-NULL / Null compensation is imported separately from the Exness trade CSV.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-lg text-brand-muted transition-colors hover:text-brand-dark dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-3 rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-3 py-2.5 text-[11px] text-brand-muted dark:bg-brand-accent/10">
            <p className="font-semibold text-brand-accent">Automatic rules</p>
            <p className="mt-1">
              Only Deposit and Withdrawal are imported here · Status must be Done or Sent · Transfer entries are ignored · Invoice ID is the unique key. D-NULL / Null compensation is detected automatically when you upload the Exness trade CSV.
            </p>
          </div>

          <label className="mb-1.5 block text-xs font-semibold dark:text-white">
            Exness Transaction History JSON
          </label>
          <textarea
            autoFocus
            rows={13}
            value={rawJson}
            onChange={(event) => setRawJson(event.target.value)}
            onPaste={handlePaste}
            spellCheck={false}
            placeholder={'Paste the JSON here…\n\nIt will sync immediately after paste.'}
            className="w-full resize-y rounded-xl border bg-gray-50 px-3 py-3 font-mono text-[11px] leading-relaxed outline-none transition-colors focus:border-brand-accent dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />

          {syncing && (
            <div className="mt-3 rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-3 py-3 text-sm text-brand-accent dark:bg-brand-accent/10">
              ⟳ Syncing Exness transactions…
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-900/15 dark:text-red-400">
              {error}
            </div>
          )}

          {summary && !syncing && <div className="mt-3"><SummaryCard summary={summary} /></div>}

          {summary?.warnings && summary.warnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/15">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Import notes</p>
              <div className="mt-1 space-y-1">
                {summary.warnings.slice(0, 5).map((warning) => (
                  <p key={warning} className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
                    • {warning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3 dark:border-gray-700">
          <p className="text-[10px] text-brand-muted">
            Paste newer or overlapping history anytime. Existing Invoice IDs stay untouched; only new Invoice IDs are appended.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-gray-600 dark:text-white"
            >
              Close
            </button>
            <button
              onClick={() => void runSync(rawJson)}
              disabled={syncing || !rawJson.trim()}
              className="rounded-lg bg-brand-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync pasted JSON'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
