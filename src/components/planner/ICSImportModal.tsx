import { useState, useRef } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { parseICS, fetchICS } from '@/lib/importICS';
import { usePlannerStore } from '@/store/plannerStore';
import { useTaskStore } from '@/store/taskStore';
import { usePriorityStore } from '@/store/priorityStore';
import type { ICSEvent } from '@/lib/importICS';
import type { Priority } from '@/types';

interface Props {
  onClose: () => void;
}

type Step = 'input' | 'preview' | 'done';

// A deadline event has the same start and end time (or isAllDay with no real duration)
function isDeadline(ev: ICSEvent): boolean {
  return ev.dtStart.getTime() === ev.dtEnd.getTime() || ev.isAllDay;
}

// Duration in minutes between two dates, clamped to 30–480
function durationMins(start: Date, end: Date): number {
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  if (diff <= 0) return 30;
  return Math.min(480, Math.max(30, Math.round(diff / 30) * 30));
}

function formatTimeGMT8(d: Date): string {
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatEventTime(ev: ICSEvent): string {
  if (ev.isAllDay) return 'All day';
  const isSame = ev.dtStart.getTime() === ev.dtEnd.getTime();
  const start = formatTimeGMT8(ev.dtStart);
  if (isSame) return `Due ${start}`;
  return `${start} – ${formatTimeGMT8(ev.dtEnd)}`;
}

// Guess priority based on how soon the deadline is
function guessPriority(dateStr: string): Priority {
  const today = new Date();
  const due = new Date(dateStr + 'T12:00:00');
  const days = differenceInCalendarDays(due, today);
  if (days <= 1) return 'high';
  if (days <= 4) return 'medium';
  return 'low';
}

// Derive a category from the summary text
function guessCategory(summary: string): 'work' | 'personal' | 'health' | 'learning' {
  const s = summary.toLowerCase();
  if (/quiz|exam|test|assignment|project|hw|homework|lab|activity|learning|peer|course/.test(s))
    return 'learning';
  if (/meeting|work|standup|review|deploy|release/.test(s)) return 'work';
  if (/gym|run|workout|health|doctor|yoga/.test(s)) return 'health';
  return 'personal';
}

// Extract course code from Canvas-style titles
function parseTitle(raw: string): { title: string; course?: string | undefined } {
  const match = raw.match(/^(.*?)\s*\[([A-Z]{2,4}\d{3}[A-Za-z0-9]*)\]\s*$/);
  if (match && match[2]) return { title: match[1]!.trim(), course: match[2] };
  return { title: raw };
}

export default function ICSImportModal({ onClose }: Props) {
  const { addTask: addScheduledTask } = usePlannerStore();
  const { addTask: addLibraryTask, tasks: libraryTasks, fetchAll } = useTaskStore();
  const { addItem: addPriorityItem } = usePriorityStore();

  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<ICSEvent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedPlanner, setImportedPlanner] = useState(0);
  const [importedPriority, setImportedPriority] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const deadlines = events.filter(isDeadline);
  const scheduled = events.filter((ev) => !isDeadline(ev));

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
      } catch {
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
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    let plannerCount = 0;
    let priorityCount = 0;

    await fetchAll();

    for (const ev of events) {
      if (!selected.has(ev.uid)) continue;

      if (isDeadline(ev)) {
        // ── Route to Priority Panel ──────────────────────────────────────
        const priority = guessPriority(ev.dtStartDateStr);
        await addPriorityItem(ev.summary, priority, ev.dtStartDateStr);
        priorityCount++;
      } else {
        // ── Route to Day Planner ─────────────────────────────────────────
        const dateStr = ev.dtStartDateStr;
        const slot = ev.dtStartSlot;
        const dur = durationMins(ev.dtStart, ev.dtEnd);
        const category = guessCategory(ev.summary);

        let taskId = libraryTasks.find((t) => t.title === ev.summary)?.id;
        if (!taskId) {
          await addLibraryTask({
            title: ev.summary,
            category,
            color:
              category === 'learning' ? '#F59E0B' : category === 'work' ? '#4F6EF7' : '#7C3AED',
            durationMins: dur,
            recurring: { type: 'none' },
            ...(ev.description ? { notes: ev.description.slice(0, 500) } : {}),
          });
          await new Promise((r) => setTimeout(r, 80));
          const { tasks } = useTaskStore.getState();
          taskId = tasks.find((t) => t.title === ev.summary)?.id;
        }

        if (taskId) {
          await addScheduledTask(taskId, dateStr, slot);
          plannerCount++;
        }
      }
    }

    setImportedPlanner(plannerCount);
    setImportedPriority(priorityCount);
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

  const toggleGroup = (evs: ICSEvent[]) => {
    const allSelected = evs.every((e) => selected.has(e.uid));
    setSelected((prev) => {
      const next = new Set(prev);
      evs.forEach((e) => (allSelected ? next.delete(e.uid) : next.add(e.uid)));
      return next;
    });
  };

  const selectedDeadlines = deadlines.filter((e) => selected.has(e.uid));
  const selectedScheduled = scheduled.filter((e) => selected.has(e.uid));

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
                {events.length} events · {deadlines.length} deadlines · {scheduled.length} scheduled
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

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t dark:border-gray-700" />
              <span className="text-xs text-brand-muted">or</span>
              <div className="flex-1 border-t dark:border-gray-700" />
            </div>

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

        {/* ── Step 2: Preview ── */}
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
              {/* ── Deadlines → Priority Panel ── */}
              {deadlines.length > 0 && (
                <>
                  <div
                    className="px-4 py-2 sticky top-0 z-10 flex items-center justify-between dark:border-gray-700"
                    style={{
                      background: 'var(--df-surface2, #0f172a)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                        ⭐ Deadlines → Priority panel
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                        {deadlines.length}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleGroup(deadlines)}
                      className="text-xs text-brand-accent hover:underline"
                    >
                      {deadlines.every((e) => selected.has(e.uid)) ? 'Deselect' : 'Select all'}
                    </button>
                  </div>
                  {deadlines.map((ev) => {
                    const priority = guessPriority(ev.dtStartDateStr);
                    const priorityColor =
                      priority === 'high'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : priority === 'medium'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
                    return (
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
                          {(() => {
                            const { title: t, course: c } = parseTitle(ev.summary);
                            return (
                              <>
                                <div
                                  className={`flex items-center gap-1.5 ${!selected.has(ev.uid) ? 'opacity-40' : ''}`}
                                >
                                  <p className="text-sm font-medium dark:text-white truncate">
                                    {t}
                                  </p>
                                  {c && (
                                    <span className="text-[9px] font-semibold px-1.5 py-px rounded shrink-0 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300">
                                      {c}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-brand-muted">
                                    Due {format(new Date(ev.dtStartDateStr + 'T12:00:00'), 'MMM d')}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${priorityColor}`}
                                  >
                                    {priority}
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
                              </>
                            );
                          })()}
                        </div>
                        <span className="text-[10px] text-amber-500 dark:text-amber-400 shrink-0 mt-1 font-medium">
                          ⭐ priority
                        </span>
                      </label>
                    );
                  })}
                </>
              )}

              {/* ── Scheduled → Day Planner ── */}
              {scheduled.length > 0 && (
                <>
                  <div
                    className="px-4 py-2 sticky top-0 z-10 flex items-center justify-between dark:border-gray-700"
                    style={{
                      background: 'var(--df-surface2, #0f172a)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-brand-accent uppercase tracking-wide">
                        📅 Scheduled → Day planner
                      </span>
                      <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded-full">
                        {scheduled.length}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleGroup(scheduled)}
                      className="text-xs text-brand-accent hover:underline"
                    >
                      {scheduled.every((e) => selected.has(e.uid)) ? 'Deselect' : 'Select all'}
                    </button>
                  </div>
                  {scheduled.map((ev) => (
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
                        {(() => {
                          const { title: t, course: c } = parseTitle(ev.summary);
                          return (
                            <div
                              className={`flex items-center gap-1.5 ${!selected.has(ev.uid) ? 'opacity-40' : ''}`}
                            >
                              <p className="text-sm font-medium dark:text-white truncate">{t}</p>
                              {c && (
                                <span className="text-[9px] font-semibold px-1.5 py-px rounded shrink-0 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300">
                                  {c}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-brand-muted">
                            {format(new Date(ev.dtStartDateStr + 'T12:00:00'), 'MMM d')} ·{' '}
                            {formatEventTime(ev)}
                          </span>
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
                      <span className="text-[10px] text-brand-accent shrink-0 mt-1 font-medium">
                        📅 planner
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>

            {/* Summary footer */}
            <div className="px-4 py-2 border-t dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3 text-xs text-brand-muted mb-2">
                {selectedDeadlines.length > 0 && (
                  <span>⭐ {selectedDeadlines.length} → Priority panel</span>
                )}
                {selectedScheduled.length > 0 && (
                  <span>📅 {selectedScheduled.length} → Day planner</span>
                )}
              </div>
              <div className="flex gap-2">
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
                  className="flex-2 bg-brand-accent text-white rounded-lg py-2 px-4 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {importing
                    ? 'Importing…'
                    : `Import ${selected.size} event${selected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">✅</span>
            <div>
              <p className="font-semibold text-lg dark:text-white">Import complete!</p>
              <div className="flex flex-col gap-1 mt-2">
                {importedPriority > 0 && (
                  <p className="text-sm text-brand-muted">
                    ⭐ <strong className="dark:text-white">{importedPriority}</strong> deadline
                    {importedPriority !== 1 ? 's' : ''} added to Priority panel
                  </p>
                )}
                {importedPlanner > 0 && (
                  <p className="text-sm text-brand-muted">
                    📅 <strong className="dark:text-white">{importedPlanner}</strong> event
                    {importedPlanner !== 1 ? 's' : ''} added to Day planner
                  </p>
                )}
              </div>
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
