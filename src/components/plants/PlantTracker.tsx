import { useEffect, useState } from 'react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { usePlantStore } from '@/store/plantStore';
import PlantForm from '@/components/plants/PlantForm';
import type { Plant } from '@/store/plantStore';

// ─── helpers ──────────────────────────────────────────────────────────────────

interface StageStatus {
  stageName: string;
  totalDays: number;
  elapsed: number;
  progress: number;
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
  if (status === 'completed') return '#9ca3af';
  if (status === 'upcoming') return '#bbf7d0';
  const t = total <= 1 ? 0.5 : idx / (total - 1);
  return t < 0.5 ? '#16a34a' : '#65a30d';
}

function statusBadge(plant: Plant, stages: StageStatus[], currentIdx: number, isDone: boolean) {
  if (isDone) return null; // handled separately as a banner
  if (currentIdx < 0) return null;
  const active = stages[currentIdx];
  if (!active) return null;
  const daysLeft = active.totalDays - active.elapsed;
  const isUrgent = daysLeft <= 3;
  const isLastStage = currentIdx + 1 >= stages.length;
  const nextName = isLastStage ? 'Done' : (plant.stages[currentIdx + 1]?.name ?? 'Next');
  const label = isLastStage ? `${daysLeft}d to harvest` : `→ ${nextName} in ${daysLeft}d`;
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap
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
  onDuplicate,
  onReplant,
  onArchive,
}: {
  plant: Plant;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReplant: () => void;
  onArchive: () => void;
}) {
  const today = new Date();
  const { stages, currentStageIdx, totalDays, daysElapsed, isDone } = computeStages(plant, today);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const overallProgress = Math.min(1, daysElapsed / totalDays);
  const harvestDate = addDays(parseISO(plant.plantedAt), totalDays);

  return (
    <div className="px-3 py-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{plant.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold dark:text-white truncate">{plant.name}</p>
            <p className="text-[11px] text-brand-muted">
              {isDone
                ? `Harvested ${format(harvestDate, 'MMM d, yyyy')}`
                : `Planted ${format(parseISO(plant.plantedAt), 'MMM d')} · Day ${Math.min(daysElapsed, totalDays)}/${totalDays}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {statusBadge(plant, stages, currentStageIdx, isDone)}
          <div className="relative">
            <button
              onClick={() => setShowActions((s) => !s)}
              className="text-gray-400 hover:text-brand-accent text-base px-1 leading-none"
              title="Actions"
            >
              ⋯
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-6 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 w-36 overflow-hidden text-xs">
                  <button
                    onClick={() => {
                      onEdit();
                      setShowActions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white flex items-center gap-2"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => {
                      onDuplicate();
                      setShowActions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white flex items-center gap-2"
                  >
                    📋 Duplicate
                  </button>
                  {isDone && (
                    <button
                      onClick={() => {
                        onReplant();
                        setShowActions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-green-600 dark:text-green-400 flex items-center gap-2"
                    >
                      🌱 Replant
                    </button>
                  )}
                  {!plant.archived && (
                    <button
                      onClick={() => {
                        onArchive();
                        setShowActions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-brand-muted flex items-center gap-2"
                    >
                      🗂 Archive
                    </button>
                  )}
                  {confirmDelete ? (
                    <div className="flex items-center gap-1 px-3 py-2 border-t dark:border-gray-700">
                      <span className="text-red-500 text-[10px] flex-1">Sure?</span>
                      <button
                        onClick={() => {
                          onDelete();
                          setShowActions(false);
                        }}
                        className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold"
                      >
                        Del
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-[10px] text-gray-400"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-red-400 flex items-center gap-2 border-t dark:border-gray-700"
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Harvested banner */}
      {isDone ? (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">
              🎉 Harvest complete!
            </p>
            <p className="text-[11px] text-green-600 dark:text-green-500">
              Grew for {totalDays} days across {plant.stages.length} stage
              {plant.stages.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onReplant}
              className="text-[11px] bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700"
            >
              🌱 Replant
            </button>
            <button
              onClick={onArchive}
              className="text-[11px] border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 px-2 py-1 rounded-lg font-medium hover:bg-green-100 dark:hover:bg-green-900/30"
            >
              Archive
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Overall progress bar */}
          <div className="df-progress-sm mb-2.5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${overallProgress * 100}%`, backgroundColor: '#16a34a' }}
            />
          </div>

          {/* Stage list — vertical stacked, compact */}
          <div className="flex flex-col gap-1.5">
            {stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Stage dot / check */}
                <div
                  className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
                  style={{
                    backgroundColor:
                      stage.status === 'completed'
                        ? '#9ca3af'
                        : stage.status === 'active'
                          ? '#16a34a'
                          : '#e5e7eb',
                    color: stage.status === 'upcoming' ? '#9ca3af' : 'white',
                  }}
                >
                  {stage.status === 'completed' ? '✓' : i + 1}
                </div>

                {/* Stage name + dates */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-[11px] font-medium truncate
                        ${
                          stage.status === 'active'
                            ? 'text-green-700 dark:text-green-400'
                            : stage.status === 'completed'
                              ? 'text-gray-400'
                              : 'text-brand-muted'
                        }`}
                    >
                      {stage.stageName}
                    </span>
                    <span className="text-[10px] text-brand-muted shrink-0">
                      {stage.status === 'completed'
                        ? `✓ ${stage.totalDays}d`
                        : stage.status === 'active'
                          ? `${stage.elapsed}/${stage.totalDays}d`
                          : `${stage.totalDays}d`}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="df-progress-sm">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stage.progress * 100}%`,
                        backgroundColor: stageColor(stage.status, i, stages.length),
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-brand-muted">
              🎯 Harvest by {format(harvestDate, 'MMM d, yyyy')}
            </p>
            {plant.notes && (
              <p className="text-[11px] text-brand-muted italic truncate max-w-[50%]">
                {plant.notes}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlantTracker() {
  const { plants, loading, fetchPlants, addPlant, deletePlant, archivePlant } = usePlantStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plant | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const active = plants.filter((p) => !p.archived);
  const archived = plants.filter((p) => p.archived);

  const sorted = [...active].sort((a, b) => {
    const today = new Date();
    const da = computeStages(a, today);
    const db = computeStages(b, today);
    if (da.isDone && !db.isDone) return 1;
    if (!da.isDone && db.isDone) return -1;
    return da.daysElapsed - db.daysElapsed;
  });

  const handleDuplicate = (plant: Plant) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    addPlant({
      name: `${plant.name} (copy)`,
      emoji: plant.emoji,
      plantedAt: today,
      stages: plant.stages,
      archived: false,
      ...(plant.notes ? { notes: plant.notes } : {}),
    });
  };

  const handleReplant = (plant: Plant) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    addPlant({
      name: plant.name,
      emoji: plant.emoji,
      plantedAt: today,
      stages: plant.stages,
      archived: false,
      ...(plant.notes ? { notes: plant.notes } : {}),
    });
  };

  const readyCount = active.filter((plant) => computeStages(plant, new Date()).isDone).length;
  const activeStageCount = active.length - readyCount;

  return (
    <div className="df-plants-workspace">
      <section className="df-plants-hero">
        <div>
          <span className="df-kicker">GROWTH TRACKER</span>
          <h2>See what is growing, what is next, and what is ready.</h2>
          <p>Each plant keeps its stage timeline visible so you can act before a transition gets missed.</p>
        </div>
        <button className="df-btn df-btn-primary" onClick={() => { setEditing(undefined); setShowForm(true); }}>+ Add plant</button>
      </section>

      <section className="df-plant-kpis">
        <div><span>Growing</span><strong>{activeStageCount}</strong><small>in active stages</small></div>
        <div><span>Ready</span><strong>{readyCount}</strong><small>completed cycles</small></div>
        <div><span>Archived</span><strong>{archived.length}</strong><small>past grows</small></div>
        <div><span>Total tracked</span><strong>{plants.length}</strong><small>all plant records</small></div>
      </section>

      {loading && <div className="df-empty-state"><strong>Loading plant data…</strong></div>}

      {!loading && sorted.length === 0 && (
        <div className="df-empty-state">
          <span style={{ fontSize: 32 }}>🪴</span>
          <strong>No plants yet.</strong>
          <p>Add the first grow and DayFlow will map each stage from planted date to harvest.</p>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <section className="df-plants-grid">
          {sorted.map((plant) => (
            <article key={plant.id} className="df-plant-card overflow-hidden">
              <PlantRow
                plant={plant}
                onEdit={() => { setEditing(plant); setShowForm(true); }}
                onDelete={() => deletePlant(plant.id)}
                onDuplicate={() => handleDuplicate(plant)}
                onReplant={() => handleReplant(plant)}
                onArchive={() => archivePlant(plant.id)}
              />
            </article>
          ))}
        </section>
      )}

      {archived.length > 0 && (
        <section className="df-plants-archive">
          <button onClick={() => setShowArchived(!showArchived)} className="df-plants-archive-toggle">
            <span><b>Archived grows</b><small>{archived.length} previous plant{archived.length > 1 ? 's' : ''}</small></span>
            <span>{showArchived ? '−' : '+'}</span>
          </button>
          {showArchived && (
            <div className="df-plants-grid is-archive">
              {archived.map((plant) => (
                <article key={plant.id} className="df-plant-card overflow-hidden opacity-70">
                  <PlantRow
                    plant={plant}
                    onEdit={() => { setEditing(plant); setShowForm(true); }}
                    onDelete={() => deletePlant(plant.id)}
                    onDuplicate={() => handleDuplicate(plant)}
                    onReplant={() => handleReplant(plant)}
                    onArchive={() => {}}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {showForm && (
        <PlantForm
          {...(editing ? { editing } : {})}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
