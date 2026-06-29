import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { parseICS, fetchICS } from '@/lib/importICS';
import { usePlannerStore } from '@/store/plannerStore';
import { useTaskStore } from '@/store/taskStore';
import type { ICSEvent } from '@/lib/importICS';

interface Props {
  onClose: () => void;
}

type Step = 'input' | 'preview' | 'done';

// Duration in minutes between two dates, clamped to 30–480
function durationMins(start: Date, end: Date): number {
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  if (diff <= 0) return 30; // deadline-style events (same start/end)
  return Math.min(480, Math.max(30, Math.round(diff / 30) * 30));
}

function formatTimeGMT8(d: Date): string {
  // d is already shifted to GMT+8, so read UTC fields
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatEventTime(event: ICSEvent): string {
  if (event.isAllDay) return 'All day';
  const start = formatTimeGMT8(event.dtStart);
  const isSameTime = event.dtStart.getTime() === event.dtEnd.getTime();
  if (isSameTime) return `Due ${start}`;
  return `${start} – ${formatTimeGMT8(event.dtEnd)}`;
}

// Derive a category from the summary text
function guessCategory(summary: string): 'work' | 'personal' | 'health' | 'learning' {
  const s = summary.toLowerCase();
  if (/quiz|exam|test|assignment|project|hw|homework|lab|activity|learning/.test(s))
    return 'learning';
  if (/meeting|work|standup|review|deploy|release/.test(s)) return 'work';
  if (/gym|run|workout|health|doctor|yoga/.test(s)) return 'health';
  return 'personal';
}

export default function ICSImportModal({ onClose }: Props) {
  const { addTask: addScheduledTask } = usePlannerStore();
  const { addTask: addLibraryTask, tasks: libraryTasks, fetchAll } = useTaskStore();

  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<ICSEvent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parse from file upload ────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file.name.endsWith('.ics') && file.type !== 'text/calendar') {
      setError('Please upload a .ics file');
      return;
    }
    setLoading(true);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseICS(text);
        if (parsed.length === 0) {
          setError('No events found in this file');
        } else {
          setEvents(parsed);
          setSelected(new Set(parsed.map((ev) => ev.uid)));
          setStep('preview');
        }
      } catch (err) {
        setError('Failed to parse ICS file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // ── Fetch from URL ────────────────────────────────────────────────────────
  const handleURL = async () => {
    if (!url.trim()) {
      setError('Enter a calendar URL');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const parsed = await fetchICS(url.trim());
      if (parsed.length === 0) {
        setError('No events found at this URL');
      } else {
        setEvents(parsed);
        setSelected(new Set(parsed.map((ev) => ev.uid)));
        setStep('preview');
      }
    } catch (err) {
      setError(`Could not fetch calendar: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Import selected events into DayFlow ──────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    let count = 0;

    // Ensure task library is loaded
    await fetchAll();

    for (const event of events) {
      if (!selected.has(event.uid)) continue;

      // Use pre-computed GMT+8 date string and slot from the parser
      const dateStr = event.dtStartDateStr;
      const slot = event.dtStartSlot;
      const dur = event.isAllDay ? 30 : durationMins(event.dtStart, event.dtEnd);
      const category = guessCategory(event.summary);

      // Check if a matching task already exists in library
      let taskId = libraryTasks.find((t) => t.title === event.summary)?.id;

      if (!taskId) {
        // Create task in library first
        await addLibraryTask({
          title: event.summary,
          category,
          color: category === 'learning' ? '#F59E0B' : category === 'work' ? '#4F6EF7' : '#7C3AED',
          durationMins: dur,
          recurring: { type: 'none' },
          ...(event.description ? { notes: event.description.slice(0, 500) } : {}),
        });

        // Wait a tick for the store to update
        await new Promise((r) => setTimeout(r, 80));
        const { tasks } = useTaskStore.getState();
        taskId = tasks.find((t) => t.title === event.summary)?.id;
      }

      if (taskId) {
        await addScheduledTask(taskId, dateStr, slot);
        count++;
      }
    }

    setImportedCount(count);
    setStep('done');
    setImporting(false);
  };

  const toggleEvent = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === events.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(events.map((e) => e.uid)));
    }
  };

  // Group events by date for preview
  const grouped = events.reduce<Record<string, ICSEvent[]>>((acc, ev) => {
    const key = format(ev.dtStart, 'yyyy-MM-dd');
    (acc[key] ??= []).push(ev);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between rounded-t-2xl sm:rounded-t-xl shrink-0"
          style={{ background: 'var(--df-surface, #1e293b)' }}
        >
          <div>
            <h2 className="font-semibold text-white text-sm">📅 Import Calendar</h2>
            {step === 'preview' && (
              <p className="text-xs text-gray-400 mt-0.5">
                {events.length} events found · {selected.size} selected
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        {/* ── Step 1: Input ── */}
        {step === 'input' && (
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            {/* File upload */}
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
                Option 1 — Upload .ics file
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-6
                  flex flex-col items-center gap-2 text-brand-muted hover:border-brand-accent
                  hover:text-brand-accent transition-colors"
              >
                <span className="text-3xl">📂</span>
                <span className="text-sm font-medium">Click to choose .ics file</span>
                <span className="text-xs">Exported from Google Calendar, Canvas, Outlook…</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t dark:border-gray-700" />
              <span className="text-xs text-brand-muted">or</span>
              <div className="flex-1 border-t dark:border-gray-700" />
            </div>

            {/* URL */}
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
                Option 2 — Subscribe via URL
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="https://…/calendar.ics"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleURL()}
                />
                <button
                  onClick={handleURL}
                  disabled={loading}
                  className="bg-brand-accent text-white px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {loading ? '…' : 'Fetch'}
                </button>
              </div>
              <p className="text-xs text-brand-muted mt-1.5">
                Works with Canvas, Google Calendar (iCal link), Outlook, and any public .ics URL
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error.split('\n').map((line, i) => (
                  <p
                    key={i}
                    className={`text-red-600 dark:text-red-400 ${i === 0 ? 'text-sm font-medium' : 'text-xs mt-1 opacity-80'}`}
                  >
                    {line}
                  </p>
                ))}
                <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-medium">
                  👆 Try uploading the .ics file directly instead
                </p>
              </div>
            )}

            {loading && (
              <div className="text-center py-4">
                <p className="text-sm text-brand-muted">Fetching calendar…</p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Step 2: Preview & select ── */}
        {step === 'preview' && (
          <>
            <div className="px-4 py-2 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
              <button
                onClick={toggleAll}
                className="text-xs text-brand-accent hover:underline font-medium"
              >
                {selected.size === events.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-brand-muted">
                {selected.size} of {events.length} selected
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {sortedDates.map((dateStr) => (
                <div key={dateStr}>
                  <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                      {format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d yyyy')}
                    </p>
                  </div>
                  {grouped[dateStr]!.map((ev) => (
                    <label
                      key={ev.uid}
                      className="flex items-start gap-3 px-4 py-2.5 border-b dark:border-gray-700
                        hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(ev.uid)}
                        onChange={() => toggleEvent(ev.uid)}
                        className="mt-0.5 shrink-0 accent-brand-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium dark:text-white truncate ${!selected.has(ev.uid) ? 'opacity-40' : ''}`}
                        >
                          {ev.summary}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-brand-muted">{formatEventTime(ev)}</span>
                          <span className="text-xs px-1.5 py-px rounded bg-gray-100 dark:bg-gray-700 text-brand-muted capitalize">
                            {guessCategory(ev.summary)}
                          </span>
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-brand-accent hover:underline shrink-0"
                            >
                              ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t dark:border-gray-700 flex gap-2 shrink-0">
              <button
                onClick={() => {
                  setStep('input');
                  setError('');
                }}
                className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="flex-1 bg-brand-accent text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {importing
                  ? 'Importing…'
                  : `Import ${selected.size} event${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">✅</span>
            <div>
              <p className="font-semibold text-lg dark:text-white">
                {importedCount} events imported!
              </p>
              <p className="text-sm text-brand-muted mt-1">
                They've been added to your Day view. Check the Day or Week tab to see them.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
