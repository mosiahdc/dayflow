import { useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { CATEGORY_COLORS } from '@/types';
import type { Category, Task, RecurringPattern, DayOfWeek } from '@/types';

const DEFAULT_CATEGORIES: string[] = ['work', 'personal', 'health', 'learning'];
const DEFAULT_COLORS: Record<string, string> = { ...CATEGORY_COLORS };
const PRESET_DURATIONS = [30, 60, 90, 120, 180, 240, 300, 360, 420, 480];
const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const EXTRA_COLORS = [
  '#EC4899',
  '#F97316',
  '#EAB308',
  '#84CC16',
  '#06B6D4',
  '#8B5CF6',
  '#14B8A6',
  '#F43F5E',
];

const CAT_STORAGE_KEY = 'dayflow-custom-categories';

// Load persisted custom categories from localStorage
function loadSavedCategories(): { categories: string[]; colorMap: Record<string, string> } {
  try {
    const saved = localStorage.getItem(CAT_STORAGE_KEY);
    if (!saved) return { categories: DEFAULT_CATEGORIES, colorMap: { ...DEFAULT_COLORS } };
    const parsed = JSON.parse(saved) as { categories: string[]; colorMap: Record<string, string> };
    return {
      categories: parsed.categories ?? DEFAULT_CATEGORIES,
      colorMap: { ...DEFAULT_COLORS, ...(parsed.colorMap ?? {}) },
    };
  } catch {
    return { categories: DEFAULT_CATEGORIES, colorMap: { ...DEFAULT_COLORS } };
  }
}

interface Props {
  onClose: () => void;
  editing?: Task | undefined;
  onSave?: (taskId: string) => Promise<void>;
}

export default function TaskForm({ onClose, editing, onSave }: Props) {
  const { addTask, updateTask } = useTaskStore();

  const saved = loadSavedCategories();

  const [title, setTitle] = useState(editing?.title ?? '');
  const [category, setCategory] = useState<string>(editing?.category ?? 'work');
  const [durationMins, setDurationMins] = useState(editing?.durationMins ?? 30);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Category state — loaded from localStorage so custom ones persist
  const [categories, setCategories] = useState<string[]>(saved.categories);
  const [colorMap, setColorMap] = useState<Record<string, string>>(saved.colorMap);
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(EXTRA_COLORS[0] ?? '#EC4899');

  const [useCustomDur, setUseCustomDur] = useState(false);
  const [customDurInput, setCustomDurInput] = useState('');
  const [durError, setDurError] = useState('');

  const [recurring, setRecurring] = useState<RecurringPattern>(
    editing?.recurring ?? { type: 'none' }
  );
  const [recurDays, setRecurDays] = useState<DayOfWeek[]>(
    editing?.recurring.type === 'weekly' ? editing.recurring.days : []
  );

  // Custom color override — when set, takes precedence over category color
  const [customColor, setCustomColor] = useState<string>(
    // If editing task has a color that differs from its category default, treat as custom
    editing?.color &&
      editing.color !==
        (CATEGORY_COLORS[editing.category as keyof typeof CATEGORY_COLORS] ?? '#4F6EF7')
      ? editing.color
      : ''
  );
  const [showColorPicker, setShowColorPicker] = useState(!!customColor);

  const activeColor = customColor || colorMap[category] || '#4F6EF7';

  const saveCustomCategories = (cats: string[], map: Record<string, string>) => {
    // Only persist the non-default ones (or all — both work fine)
    localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify({ categories: cats, colorMap: map }));
  };

  const addNewCategory = () => {
    const name = newCatName.trim().toLowerCase();
    if (!name) return;
    if (categories.includes(name)) {
      setCategory(name);
      setNewCatName('');
      setShowCatInput(false);
      return;
    }
    const newCats = [...categories, name];
    const newMap = { ...colorMap, [name]: newCatColor };
    setCategories(newCats);
    setColorMap(newMap);
    setCategory(name);
    setNewCatName('');
    setShowCatInput(false);
    saveCustomCategories(newCats, newMap);
  };

  const handleCustomDur = (val: string) => {
    setCustomDurInput(val);
    const n = parseInt(val, 10);
    if (!val) {
      setDurError('');
      return;
    }
    if (isNaN(n) || n <= 0) {
      setDurError('Must be a positive number');
      return;
    }
    if (n > 1440) {
      setDurError('Max 1440 minutes (24h)');
      return;
    }
    const rounded = Math.round(n / 30) * 30;
    const clamped = Math.max(30, Math.min(1440, rounded));
    setDurError('');
    setDurationMins(clamped);
  };

  const save = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (durationMins < 30 || durationMins > 1440) {
      setError('Invalid duration');
      return;
    }
    if (useCustomDur && durError) return;

    setLoading(true);
    try {
      const finalRecurring: RecurringPattern =
        recurring.type === 'weekly'
          ? { type: 'weekly', days: recurDays }
          : { type: recurring.type };

      const payload = {
        title: title.trim(),
        category: category as Category,
        durationMins,
        color: activeColor,
        recurring: finalRecurring,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };

      if (editing) {
        await updateTask(editing.id, payload);
        onClose();
      } else {
        await addTask({ ...payload });

        if (onSave) {
          let attempts = 0;
          const waitForTask = async (): Promise<void> => {
            const { tasks } = useTaskStore.getState();
            const newTask = tasks.find(
              (t) => t.title === payload.title && t.category === payload.category
            );
            if (newTask) {
              await onSave(newTask.id);
            } else if (attempts < 10) {
              attempts++;
              await new Promise((r) => setTimeout(r, 100));
              await waitForTask();
            }
          };
          await waitForTask();
        }
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-4 dark:text-white">
          {editing ? 'Edit Task' : 'New Task'}
        </h2>

        <label className="text-xs text-brand-muted mb-1 block">Task name</label>
        <input
          autoFocus
          className="w-full border rounded-lg px-3 py-2 mb-4 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        {/* Category */}
        <label className="text-xs text-brand-muted mb-1 block">Category</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize border-2 transition-all"
              style={{
                borderColor: colorMap[c] ?? '#4F6EF7',
                backgroundColor: category === c ? (colorMap[c] ?? '#4F6EF7') : undefined,
                color: category === c ? 'white' : undefined,
              }}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setShowCatInput(!showCatInput)}
            className="px-2.5 py-1 rounded-full text-xs font-semibold border-2 border-dashed border-gray-300 dark:border-gray-600 text-brand-muted hover:border-brand-accent hover:text-brand-accent transition-all"
          >
            + Add
          </button>
        </div>

        {showCatInput && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3 flex flex-col gap-2">
            <input
              autoFocus
              className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-600 dark:text-white dark:border-gray-500"
              placeholder="Category name…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewCategory()}
            />
            <div>
              <p className="text-xs text-brand-muted mb-1">Pick color</p>
              <div className="flex gap-1.5 flex-wrap">
                {EXTRA_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewCatColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${newCatColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCatInput(false)}
                className="flex-1 border rounded py-1 text-xs dark:text-white dark:border-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={addNewCategory}
                className="flex-1 bg-brand-accent text-white rounded py-1 text-xs font-semibold"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Duration */}
        <label className="text-xs text-brand-muted mb-1 block">Duration</label>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setUseCustomDur(false)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${!useCustomDur ? 'bg-brand-accent text-white border-brand-accent' : 'dark:text-white dark:border-gray-600'}`}
          >
            Preset
          </button>
          <button
            onClick={() => setUseCustomDur(true)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${useCustomDur ? 'bg-brand-accent text-white border-brand-accent' : 'dark:text-white dark:border-gray-600'}`}
          >
            Custom
          </button>
        </div>

        {!useCustomDur ? (
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {PRESET_DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDurationMins(d)}
                className={`py-1.5 rounded text-xs font-semibold border-2 transition-all
                  ${
                    durationMins === d
                      ? 'bg-brand-accent text-white border-brand-accent'
                      : 'dark:text-white dark:border-gray-600 border-gray-200 hover:border-brand-accent'
                  }`}
              >
                {d >= 60 ? `${d / 60}h` : `${d}m`}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                placeholder="e.g. 220 → rounds to 210"
                value={customDurInput}
                onChange={(e) => handleCustomDur(e.target.value)}
                min={30}
                max={1440}
              />
              <span className="text-xs text-brand-muted shrink-0">min</span>
            </div>
            {durError ? (
              <p className="text-red-500 text-xs mt-1">{durError}</p>
            ) : customDurInput ? (
              <p className="text-brand-green text-xs mt-1">Rounded to {durationMins}m</p>
            ) : (
              <p className="text-brand-muted text-xs mt-1">
                Enter any minutes — auto-rounded to nearest 30.
              </p>
            )}
          </div>
        )}

        {/* Repeat */}
        <label className="text-xs text-brand-muted mb-1 block">Repeat</label>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(['none', 'daily', 'weekdays', 'weekly'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setRecurring(type === 'weekly' ? { type, days: recurDays } : { type })}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border-2 transition-all
                ${
                  recurring.type === type
                    ? 'bg-brand-accent text-white border-brand-accent'
                    : 'dark:text-white dark:border-gray-600 border-gray-200'
                }`}
            >
              {type === 'none' ? 'No Repeat' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {recurring.type === 'weekly' && (
          <div className="flex gap-1 mb-3">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => {
                  const next = recurDays.includes(d)
                    ? recurDays.filter((x) => x !== d)
                    : [...recurDays, d];
                  setRecurDays(next);
                  setRecurring({ type: 'weekly', days: next });
                }}
                className={`flex-1 py-1 rounded text-xs font-semibold uppercase transition-all
                  ${recurDays.includes(d) ? 'bg-brand-accent text-white' : 'bg-gray-100 dark:bg-gray-700 text-brand-muted'}`}
              >
                {d[0]}
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        <label className="text-xs text-brand-muted mb-1 block">Notes (optional)</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 mb-4 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="Any notes…"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Color — override or auto from category */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: activeColor }}
              />
              <span className="text-xs text-brand-muted capitalize">{category}</span>
            </div>
            <button
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                if (showColorPicker) setCustomColor('');
              }}
              className={`text-xs px-2 py-0.5 rounded border transition-all
                ${
                  showColorPicker
                    ? 'bg-brand-accent text-white border-brand-accent'
                    : 'text-brand-muted border-gray-300 dark:border-gray-600 hover:border-brand-accent hover:text-brand-accent'
                }`}
            >
              {showColorPicker ? '✕ Reset color' : '🎨 Custom color'}
            </button>
          </div>

          {showColorPicker && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-brand-muted mb-2">Pick a custom color</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  '#4F6EF7',
                  '#7C3AED',
                  '#10B981',
                  '#F59E0B',
                  '#EC4899',
                  '#F97316',
                  '#EAB308',
                  '#84CC16',
                  '#06B6D4',
                  '#8B5CF6',
                  '#14B8A6',
                  '#F43F5E',
                  '#EF4444',
                  '#0EA5E9',
                  '#A855F7',
                  '#22C55E',
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCustomColor(c)}
                    className={`w-7 h-7 rounded-full transition-all border-2
                      ${customColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                {/* Native color input for any color */}
                <label
                  className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center cursor-pointer hover:scale-105 transition-all overflow-hidden"
                  title="Pick any color"
                >
                  <span className="text-xs text-gray-400">+</span>
                  <input
                    type="color"
                    value={customColor || activeColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
              {customColor && (
                <p className="text-[10px] text-brand-muted mt-2">
                  Custom: {customColor} — overrides category color
                </p>
              )}
            </div>
          )}
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
            className="flex-1 bg-brand-accent text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
