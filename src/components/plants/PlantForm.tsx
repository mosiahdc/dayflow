import { useState } from 'react';
import { format } from 'date-fns';
import { usePlantStore } from '@/store/plantStore';
import type { PlantStage, Plant } from '@/store/plantStore';

const PLANT_EMOJIS = ['🌱', '🌿', '🍅', '🥬', '🌾', '🌻', '🫑', '🥕', '🌶️', '🧄', '🫚', '🍓'];

interface Props {
  editing?: Plant;
  onClose: () => void;
}

export default function PlantForm({ editing, onClose }: Props) {
  const { addPlant, updatePlant } = usePlantStore();
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '🌱');
  const [plantedAt, setPlantedAt] = useState(
    editing?.plantedAt ?? format(new Date(), 'yyyy-MM-dd')
  );
  const [stages, setStages] = useState<PlantStage[]>(
    editing?.stages ?? [
      { name: 'Germination', days: 7 },
      { name: 'Harvest', days: 32 },
    ]
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const addStage = () => setStages((s) => [...s, { name: '', days: 14 }]);

  const removeStage = (i: number) => setStages((s) => s.filter((_, idx) => idx !== i));

  const updateStage = (i: number, field: keyof PlantStage, val: string | number) =>
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, [field]: val } : st)));

  const save = async () => {
    if (!name.trim()) {
      setError('Plant name is required');
      return;
    }
    if (stages.length === 0) {
      setError('Add at least one stage');
      return;
    }
    if (stages.some((s) => !s.name.trim() || s.days < 1)) {
      setError('All stages need a name and at least 1 day');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        emoji,
        plantedAt,
        stages,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        archived: editing?.archived ?? false,
      };
      if (editing) {
        await updatePlant(editing.id, payload);
      } else {
        await addPlant(payload);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <h2 className="font-bold text-lg mb-4 dark:text-white">
            {editing ? 'Edit Plant' : 'New Plant'}
          </h2>

          {/* Emoji picker */}
          <label className="text-xs text-brand-muted mb-1 block">Choose an icon</label>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PLANT_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all
                  ${
                    emoji === e
                      ? 'bg-brand-green text-white ring-2 ring-brand-green ring-offset-1'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                  }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Name */}
          <label className="text-xs text-brand-muted mb-1 block">Plant name</label>
          <input
            autoFocus
            className="w-full border rounded-lg px-3 py-2 mb-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="e.g. Cherry Tomatoes"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Planted date */}
          <label className="text-xs text-brand-muted mb-1 block">Planted on</label>
          <input
            type="date"
            className="w-full border rounded-lg px-3 py-2 mb-4 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
            value={plantedAt}
            onChange={(e) => setPlantedAt(e.target.value)}
          />

          {/* Stages */}
          <label className="text-xs text-brand-muted mb-1 block">Growth stages</label>
          <div className="flex flex-col gap-2 mb-2">
            {stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="Stage name"
                  value={stage.name}
                  onChange={(e) => updateStage(i, 'name', e.target.value)}
                />
                <input
                  type="number"
                  className="w-16 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 text-center"
                  placeholder="Days"
                  min={1}
                  value={stage.days}
                  onChange={(e) =>
                    updateStage(i, 'days', Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
                <span className="text-xs text-brand-muted shrink-0">days</span>
                {stages.length > 1 && (
                  <button
                    onClick={() => removeStage(i)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addStage}
            className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-1.5 text-xs text-brand-muted hover:border-brand-green hover:text-brand-green transition-colors mb-4"
          >
            + Add stage
          </button>

          {/* Notes */}
          <label className="text-xs text-brand-muted mb-1 block">Notes (optional)</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 mb-4 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="Variety, location, soil mix…"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

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
              className="flex-1 bg-brand-green text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Saving…' : editing ? 'Save' : 'Plant it!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
