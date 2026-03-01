import { useEffect, useState } from 'react';
import { useReflectionStore } from '@/store/reflectionStore';

interface Props { date: string; }

export default function ReflectionPanel({ date }: Props) {
  const { fetchByDate, upsert } = useReflectionStore();
  const [accomplished, setAccomplished] = useState('');
  const [carryOver,    setCarryOver]    = useState('');
  const [saved,        setSaved]        = useState(false);
  const [open,         setOpen]         = useState(false);

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
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-brand-teal text-white px-4 py-2 flex justify-between items-center"
      >
        <span className="font-semibold text-sm">📝 Daily Reflection</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

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
  );
}