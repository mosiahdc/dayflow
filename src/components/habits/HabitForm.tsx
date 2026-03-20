import { useState } from 'react';
import { useHabitStore } from '@/store/habitStore';
import { CATEGORY_COLORS } from '@/types';
import type { Category, DayOfWeek, Habit } from '@/types';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CATEGORIES: Category[] = ['work', 'personal', 'health', 'learning'];

const QUICK_TIMES = [
  { label: '6:00 AM', value: '06:00' },
  { label: '7:00 AM', value: '07:00' },
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '8:00 PM', value: '20:00' },
  { label: '9:00 PM', value: '21:00' },
  { label: '10:00 PM', value: '22:00' },
];

function fmt12(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

interface Props {
  onClose: () => void;
  editing?: Habit | undefined;
}

export default function HabitForm({ onClose, editing }: Props) {
  const { addHabit, updateHabit } = useHabitStore();

  const [title, setTitle] = useState(editing?.title ?? '');
  const [category, setCategory] = useState<Category>(editing?.category ?? 'health');
  const [targetDays, setTargetDays] = useState<DayOfWeek[]>(
    editing?.targetDays ?? ['mon', 'tue', 'wed', 'thu', 'fri']
  );
  const [reminderTime, setReminderTime] = useState<string>(editing?.reminderTime ?? '');
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!editing;
  const activeColor = CATEGORY_COLORS[category];

  const toggleDay = (d: DayOfWeek) =>
    setTargetDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = async () => {
    if (!title.trim()) {
      setError('Title required');
      return;
    }
    if (targetDays.length === 0) {
      setError('Select at least one target day');
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await updateHabit(editing.id, {
          title: title.trim(),
          category,
          color: activeColor,
          targetDays,
          reminderTime: reminderTime || undefined,
        });
      } else {
        await addHabit({
          title: title.trim(),
          category,
          color: activeColor,
          targetDays,
          reminderTime: reminderTime || undefined,
        });
      }
      if (typeof onClose === 'function') onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          {isEditing && (
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: activeColor }}
            />
          )}
          <h2 className="font-bold text-lg dark:text-white">
            {isEditing ? 'Edit Habit' : 'New Habit'}
          </h2>
        </div>

        {/* Title */}
        <input
          autoFocus
          className="w-full border rounded-lg px-3 py-2 mb-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="Habit title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        {/* Category */}
        <p className="text-xs text-brand-muted mb-1">Category</p>
        <div className="flex gap-2 mb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="flex-1 py-1 rounded text-xs font-semibold capitalize border-2 transition-all"
              style={{
                borderColor: CATEGORY_COLORS[c],
                backgroundColor: category === c ? CATEGORY_COLORS[c] : undefined,
                color: category === c ? 'white' : undefined,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Target days */}
        <p className="text-xs text-brand-muted mb-1">Target days</p>
        <div className="flex gap-1 mb-4">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={`flex-1 py-1.5 rounded text-xs font-semibold uppercase transition-all
                ${
                  targetDays.includes(d)
                    ? 'text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-brand-muted'
                }`}
              style={targetDays.includes(d) ? { backgroundColor: activeColor } : {}}
            >
              {d[0]}
            </button>
          ))}
        </div>

        {/* ── Reminder ── */}
        <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-brand-muted">🔔 Reminder</p>
            {reminderTime && (
              <button
                onClick={() => {
                  setReminderTime('');
                  setShowCustomTime(false);
                }}
                className="text-xs text-red-400 hover:text-red-500 font-medium"
              >
                Remove
              </button>
            )}
          </div>

          {/* Current reminder preview */}
          {reminderTime ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-sm font-semibold text-white"
              style={{ backgroundColor: activeColor }}
            >
              <span>🔔</span>
              <span>{fmt12(reminderTime)}</span>
              <span className="text-xs font-normal opacity-80 ml-auto">target days only</span>
            </div>
          ) : (
            <p className="text-xs text-brand-muted mb-2">No reminder set — pick a time below</p>
          )}

          {/* Quick time grid */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {QUICK_TIMES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => {
                  setReminderTime(value);
                  setShowCustomTime(false);
                }}
                className={`py-1 rounded text-xs font-medium transition-all border
                  ${
                    reminderTime === value
                      ? 'text-white border-transparent'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-brand-muted hover:border-brand-accent'
                  }`}
                style={reminderTime === value ? { backgroundColor: activeColor } : {}}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setShowCustomTime(!showCustomTime)}
              className={`py-1 rounded text-xs font-medium transition-all border col-span-2
                ${
                  showCustomTime
                    ? 'bg-brand-accent text-white border-transparent'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-brand-muted hover:border-brand-accent'
                }`}
            >
              ✏️ Custom time
            </button>
          </div>

          {/* Custom time input */}
          {showCustomTime && (
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-600 dark:text-white dark:border-gray-500 mt-1"
            />
          )}

          <p className="text-[10px] text-brand-muted mt-2">
            Fires only on your target days. Allow notifications in browser settings.
          </p>
        </div>

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: activeColor }}
          >
            {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Habit'}
          </button>
        </div>
      </div>
    </div>
  );
}
