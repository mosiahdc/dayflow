import { useEffect, useState } from 'react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { usePlantStore } from '@/store/plantStore';
import PlantForm from '@/components/plants/PlantForm';
import type { Plant } from '@/store/plantStore';

// ─── helpers ──────────────────────────────────────────────────────────────────

interface StageStatus {
  stageName: string;
  totalDays: number;
  elapsed: number; // days into this stage (0 = not started)
  progress: number; // 0–1
  startDate: Date;
  endDate: Date;
  status: 'completed' | 'active' | 'upcoming';
}

function computeStages(
  plant: Plant,
  today: Date
): {
  stages: StageStatus[];
  currentStageIdx: number;
  totalDays: number;
  daysElapsed: number;
  isDone: boolean;
} {
  const planted = parseISO(plant.plantedAt);
  const daysElapsed = Math.max(0, differenceInDays(today, planted));
  const totalDays = plant.stages.reduce((acc, s) => acc + s.days, 0);
  const isDone = daysElapsed >= totalDays;

  let cursor = 0;
  let currentStageIdx = -1;
  const stages: StageStatus[] = plant.stages.map((s, i) => {
    const stageStart = cursor;
    const stageEnd = cursor + s.days;
    const startDate = addDays(planted, stageStart);
    const endDate = addDays(planted, stageEnd);

    let status: StageStatus['status'];
    let elapsed: number;
    let progress: number;

    if (daysElapsed >= stageEnd) {
      status = 'completed';
      elapsed = s.days;
      progress = 1;
    } else if (daysElapsed >= stageStart) {
      status = 'active';
      elapsed = daysElapsed - stageStart;
      progress = Math.min(1, elapsed / s.days);
      if (currentStageIdx === -1) currentStageIdx = i;
    } else {
      status = 'upcoming';
      elapsed = 0;
      progress = 0;
    }

    cursor = stageEnd;
    return { stageName: s.name, totalDays: s.days, elapsed, progress, startDate, endDate, status };
  });

  return {
    stages,
    currentStageIdx: isDone ? plant.stages.length : currentStageIdx,
    totalDays,
    daysElapsed,
    isDone,
  };
}

function stageColor(status: StageStatus['status'], idx: number, total: number): string {
  if (status === 'completed') return '#6b7280';
  if (status === 'upcoming') return '#d1fae5';
  // Active: gradient from dark green (first) to lime (last)
  const t = total <= 1 ? 0.5 : idx / (total - 1);
  if (t < 0.5) return '#16a34a';
  return '#65a30d';
}

function statusBadge(plant: Plant, stages: StageStatus[], currentIdx: number, isDone: boolean) {
  if (isDone) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
        Done
      </span>
    );
  }
  if (currentIdx < 0) return null;
  const active = stages[currentIdx];
  if (!active) return null;
  const daysLeft = active.totalDays - active.elapsed;
  const isUrgent = daysLeft <= 3;
  const isNextStage = currentIdx + 1 < stages.length;
  const label = isNextStage
    ? `${active.stageName} → ${plant.stages[currentIdx + 1]?.name ?? 'Done'} in ${daysLeft}d`
    : `${daysLeft}d left`;
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium
      ${
        isUrgent
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      }`}
    >
      {isUrgent ? '⚠️ ' : ''}
      {label}
    </span>
  );
}

// ─── PlantRow ─────────────────────────────────────────────────────────────────

function PlantRow({
  plant,
  onEdit,
  onDelete,
  onArchive,
}: {
  plant: Plant;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const today = new Date();
  const { stages, currentStageIdx, totalDays, daysElapsed, isDone } = computeStages(plant, today);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const overallProgress = Math.min(1, daysElapsed / totalDays);
  const harvestDate = addDays(parseISO(plant.plantedAt), totalDays);

  return (
    <div className="px-4 py-3 border-b dark:border-gray-700 last:border-b-0">
      {/* Top row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{plant.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold dark:text-white truncate">{plant.name}</p>
            <p className="text-xs text-brand-muted">
              Planted {format(parseISO(plant.plantedAt), 'MMM d, yyyy')}
              {' · '}Day {Math.min(daysElapsed, totalDays)} of {totalDays}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {statusBadge(plant, stages, currentStageIdx, isDone)}
          <button
            onClick={onEdit}
            className="text-gray-300 hover:text-brand-accent text-xs p-1"
            title="Edit"
          >
            ✏️
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={onDelete}
                className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold"
              >
                Del
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400">
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-300 hover:text-red-400 text-sm"
              title="Delete"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${overallProgress * 100}%`,
            backgroundColor: isDone ? '#6b7280' : '#16a34a',
          }}
        />
      </div>

      {/* Stage bars */}
      <div className="flex items-stretch gap-2 flex-wrap">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300 dark:text-gray-600 text-xs">›</span>}
            <div className="flex flex-col gap-1" style={{ minWidth: '72px', maxWidth: '110px' }}>
              {/* Stage progress bar */}
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stage.progress * 100}%`,
                    backgroundColor: stageColor(stage.status, i, stages.length),
                  }}
                />
              </div>
              {/* Labels */}
              <div
                className={`text-[10px] leading-tight ${stage.status === 'active' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-brand-muted'}`}
              >
                <span className="block truncate">{stage.stageName}</span>
                <span>
                  {stage.status === 'upcoming'
                    ? `starts ${format(stage.startDate, 'MMM d')}`
                    : stage.status === 'completed'
                      ? `done ${format(stage.endDate, 'MMM d')}`
                      : `${stage.elapsed}/${stage.totalDays}d`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Harvest / next event footer */}
      {!isDone && (
        <p className="text-xs text-brand-muted mt-2">
          {isDone ? '✅ Completed' : `🎯 Harvest by ${format(harvestDate, 'MMM d, yyyy')}`}
          {plant.notes && <span className="ml-2 italic truncate">{plant.notes}</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlantTracker() {
  const { plants, loading, fetchPlants, deletePlant, archivePlant } = usePlantStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plant | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const active = plants.filter((p) => !p.archived);
  const archived = plants.filter((p) => p.archived);

  // Sort: active first by proximity to next stage event
  const sorted = [...active].sort((a, b) => {
    const today = new Date();
    const da = computeStages(a, today);
    const db = computeStages(b, today);
    if (da.isDone && !db.isDone) return 1;
    if (!da.isDone && db.isDone) return -1;
    return da.daysElapsed - db.daysElapsed;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
      {/* Header */}
      <div
        className="text-white px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🌱</span>
          <span className="font-semibold text-sm">Plant Tracker</span>
          {active.length > 0 && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {active.length} growing
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
          className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg font-medium"
        >
          + Add Plant
        </button>
      </div>

      {loading && <div className="p-8 text-center text-sm text-brand-muted">Loading…</div>}

      {/* Plant list */}
      {!loading && sorted.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-3xl mb-2">🪴</p>
          <p className="text-sm text-brand-muted mb-1">No plants yet.</p>
          <p className="text-xs text-brand-muted">
            Add your first plant to start tracking its journey.
          </p>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div>
          {sorted.map((plant) => (
            <PlantRow
              key={plant.id}
              plant={plant}
              onEdit={() => {
                setEditing(plant);
                setShowForm(true);
              }}
              onDelete={() => deletePlant(plant.id)}
              onArchive={() => archivePlant(plant.id)}
            />
          ))}
        </div>
      )}

      {/* Archived section */}
      {archived.length > 0 && (
        <div className="border-t dark:border-gray-700">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full px-4 py-2.5 text-xs text-brand-muted flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            <span>
              🗂 {archived.length} archived plant{archived.length > 1 ? 's' : ''}
            </span>
            <span>{showArchived ? '▲' : '▼'}</span>
          </button>
          {showArchived &&
            archived.map((plant) => (
              <PlantRow
                key={plant.id}
                plant={plant}
                onEdit={() => {
                  setEditing(plant);
                  setShowForm(true);
                }}
                onDelete={() => deletePlant(plant.id)}
                onArchive={() => {}}
              />
            ))}
        </div>
      )}

      {showForm && (
        <PlantForm
          {...(editing ? { editing } : {})}
          onClose={() => {
            setShowForm(false);
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}
