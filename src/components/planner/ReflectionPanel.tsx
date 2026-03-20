import { useEffect, useState } from 'react';
import { format, parseISO, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { useReflectionStore } from '@/store/reflectionStore';
import { useUIStore } from '@/store/uiStore';
import type { Reflection } from '@/types';

interface Props {
  date: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
}

function relativeLabel(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// ── History modal ─────────────────────────────────────────────────────────────
function HistoryModal({ onClose }: { onClose: () => void }) {
  const { reflections, fetchAll, deleteReflection } = useReflectionStore();
  const { setDate, setView } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const filtered = reflections.filter(
    (r) =>
      !search ||
      r.accomplished.toLowerCase().includes(search.toLowerCase()) ||
      r.carryOver.toLowerCase().includes(search.toLowerCase()) ||
      r.date.includes(search)
  );

  const handleJump = (r: Reflection) => {
    setDate(r.date);
    setView('day');
    onClose();
  };

  const handleDelete = async (id: string) => {
    await deleteReflection(id);
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-gray-800 w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="font-bold text-base dark:text-white">📓 Reflection History</h2>
            <p className="text-xs text-brand-muted">{reflections.length} entries</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b dark:border-gray-700 shrink-0">
          <input
            autoFocus
            className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="🔍 Search reflections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-brand-muted text-center py-10">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-sm font-semibold dark:text-white">
                {reflections.length === 0 ? 'No reflections yet' : 'No matches'}
              </p>
              <p className="text-xs text-brand-muted mt-1">
                {reflections.length === 0
                  ? 'Write your first reflection in the panel below.'
                  : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {filtered.map((r) => {
                const isOpen = expanded === r.id;
                const isDeleting = confirmDelete === r.id;
                return (
                  <div key={r.id} className="px-4 py-3">
                    {/* Row header */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <button
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="flex-1 text-left group"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold dark:text-white group-hover:text-brand-teal transition-colors">
                            {dateLabel(r.date)}
                          </span>
                          <span className="text-[10px] text-brand-muted">
                            {relativeLabel(r.date)}
                          </span>
                          {r.carryOver.trim() && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                              has carry-overs
                            </span>
                          )}
                        </div>
                        {/* Preview when collapsed */}
                        {!isOpen && r.accomplished.trim() && (
                          <p className="text-xs text-brand-muted mt-0.5 truncate">
                            {r.accomplished}
                          </p>
                        )}
                      </button>

                      {/* Action buttons */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleJump(r)}
                          className="text-xs text-brand-teal hover:text-brand-teal/80 px-1.5 py-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                          title="Jump to this day"
                        >
                          ↗
                        </button>
                        {isDeleting ? (
                          <>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(r.id)}
                            className="text-gray-300 hover:text-red-400 text-sm leading-none px-1"
                            title="Delete"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="mt-2 flex flex-col gap-2 pl-0">
                        {r.accomplished.trim() && (
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-1">
                              Accomplished
                            </p>
                            <p className="text-sm dark:text-white whitespace-pre-wrap leading-relaxed">
                              {r.accomplished}
                            </p>
                          </div>
                        )}
                        {r.carryOver.trim() && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                              Carried over
                            </p>
                            <p className="text-sm dark:text-white whitespace-pre-wrap leading-relaxed">
                              {r.carryOver}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleJump(r)}
                          className="text-xs text-brand-teal hover:underline text-left self-start"
                        >
                          View {dateLabel(r.date)} in Day view →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function ReflectionPanel({ date }: Props) {
  const { fetchByDate, upsert, reflections } = useReflectionStore();
  const [accomplished, setAccomplished] = useState('');
  const [carryOver, setCarryOver] = useState('');
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Count total saved reflections for the history button badge
  const totalReflections = reflections.length;

  useEffect(() => {
    if (!open) return;
    fetchByDate(date).then((r) => {
      if (r) {
        setAccomplished(r.accomplished);
        setCarryOver(r.carryOver);
      } else {
        setAccomplished('');
        setCarryOver('');
      }
    });
  }, [date, open]);

  const save = async () => {
    await upsert(date, accomplished, carryOver);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
        {/* Header — toggle open + history button */}
        <div className="bg-brand-teal text-white px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className="font-semibold text-sm">📝 Daily Reflection</span>
            <span className="text-xs opacity-70">{open ? '▲' : '▼'}</span>
          </button>

          {/* History button */}
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors shrink-0"
            title="Browse all reflections"
          >
            <span>📓</span>
            <span>History</span>
            {totalReflections > 0 && (
              <span className="bg-white/30 rounded-full px-1.5 font-semibold">
                {totalReflections}
              </span>
            )}
          </button>
        </div>

        {open && (
          <div className="p-4 flex flex-col gap-3">
            <div>
              <label className="text-xs text-brand-muted mb-1 block">
                What did I accomplish today?
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                rows={3}
                placeholder="I completed…"
                value={accomplished}
                onChange={(e) => setAccomplished(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">
                What carries over to tomorrow?
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                rows={3}
                placeholder="Still need to…"
                value={carryOver}
                onChange={(e) => setCarryOver(e.target.value)}
              />
            </div>
            <button
              onClick={save}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors
                ${saved ? 'bg-brand-green text-white' : 'bg-brand-teal text-white hover:opacity-90'}`}
            >
              {saved ? '✓ Saved!' : 'Save Reflection'}
            </button>
          </div>
        )}
      </div>

      {/* History modal */}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </>
  );
}
