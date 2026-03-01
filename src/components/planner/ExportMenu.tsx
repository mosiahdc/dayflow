import { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { buildICS, downloadICS } from '@/lib/exportICS';
import { googleCalLink, outlookLink } from '@/lib/exportLinks';
import type { ScheduledTask } from '@/types';

interface Props {
  date: string;
}

export default function ExportMenu({ date }: Props) {
  const { scheduledTasks } = usePlannerStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dayTasks = scheduledTasks.filter((t) => t.date === date);

  const exportICS = async () => {
    if (!dayTasks.length) return;
    setLoading(true);
    try {
      const blob = await buildICS(dayTasks);
      downloadICS(blob, `dayflow-${date}.ics`);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noreferrer');
    setOpen(false);
  };

  const renderTask = (st: ScheduledTask) => (
    <div key={st.id} className="border-t dark:border-gray-700">
      <p className="text-xs text-brand-muted px-3 pt-2 truncate font-semibold">
        {st.task.title}
      </p>
      <button
        onClick={() => openLink(googleCalLink(st))}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        🗓 Add to Google Calendar
      </button>
      <button
        onClick={() => openLink(outlookLink(st))}
        className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        📨 Add to Outlook
      </button>
    </div>
  );

  if (!dayTasks.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white"
      >
        📤 Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 w-52 overflow-hidden">
            <p className="text-xs text-brand-muted px-3 py-2 border-b dark:border-gray-700">
              {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''} on {date}
            </p>
            <button
              onClick={exportICS}
              disabled={loading}
              className="w-full text-left px-3 py-2.5 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <span>📅</span>
              <div>
                <p className="font-semibold text-xs">Download .ics</p>
                <p className="text-brand-muted text-xs">Import to any calendar</p>
              </div>
            </button>
            {dayTasks.map(renderTask)}
          </div>
        </>
      )}
    </div>
  );
}