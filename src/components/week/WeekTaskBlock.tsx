import { memo } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { useUIStore } from '@/store/uiStore';
import type { ScheduledTask } from '@/types';

interface Props {
  scheduledTask: ScheduledTask;
  index: number;
  total: number;
}

// Format slot index as "8:00 AM"
function slotLabel(slot: number): string {
  const hour = Math.floor(slot / 2);
  const minute = slot % 2 === 0 ? '00' : '30';
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${period}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const WeekTaskBlock = memo(function WeekTaskBlock({ scheduledTask: st, index, total }: Props) {
  const { toggleDone } = usePlannerStore();
  const { setDate, setView } = useUIStore();

  const isOverflow = st.id.startsWith('overflow-');
  const maxSlots = 48 - st.startSlot;
  const spans = Math.min(st.task.durationMins / 30, maxSlots);
  const heightPx = spans * 36 - 2;
  const widthPct = 100 / total;
  const isShort = spans <= 1;
  const isTall = spans >= 3;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOverflow) toggleDone(st.id);
  };

  const handleJump = () => {
    setDate(st.date);
    setView('day');
  };

  return (
    <div
      onClick={handleJump}
      title={`${st.task.title} · ${slotLabel(st.startSlot)} · ${fmtDuration(st.task.durationMins)}${st.task.notes ? '\n' + st.task.notes : ''}`}
      className={`absolute top-0.5 rounded overflow-hidden border-l-2 cursor-pointer
        transition-opacity hover:opacity-90 group
        ${st.done ? 'opacity-50' : ''}`}
      style={{
        borderLeftColor: st.task.color,
        borderLeftStyle: isOverflow ? 'dashed' : 'solid',
        backgroundColor: st.done ? `${st.task.color}14` : `${st.task.color}22`,
        height: `${heightPx}px`,
        width: `calc(${widthPct}% - 2px)`,
        left: `calc(${index} * ${widthPct}%)`,
      }}
    >
      <div className="flex flex-col h-full px-1 py-0.5 overflow-hidden">
        {/* Title row */}
        <div className="flex items-start gap-1 min-w-0">
          {/* Checkbox — hidden on short blocks, shown on hover */}
          {!isOverflow && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleToggle}
              className={`shrink-0 mt-0.5 rounded border flex items-center justify-center transition-colors
                ${isShort ? 'opacity-0 group-hover:opacity-100' : ''}
                ${
                  st.done
                    ? 'bg-brand-green border-brand-green w-3 h-3'
                    : 'border-gray-400 dark:border-gray-500 w-3 h-3 hover:border-brand-green'
                }`}
            >
              {st.done && (
                <span className="text-white leading-none" style={{ fontSize: 8 }}>
                  ✓
                </span>
              )}
            </button>
          )}

          <span
            className={`text-xs font-semibold leading-tight truncate flex-1 dark:text-white
              ${st.done ? 'line-through opacity-60' : ''}`}
            style={{ color: st.task.color, filter: 'brightness(0.75)' }}
          >
            {st.task.title}
          </span>
        </div>

        {/* Duration — only on taller blocks */}
        {isTall && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
            {fmtDuration(st.task.durationMins)}
          </span>
        )}

        {/* Category pill — only on tall blocks */}
        {isTall && (
          <div className="mt-auto">
            <span
              className="text-[9px] font-medium px-1 py-0.5 rounded capitalize"
              style={{
                backgroundColor: `${st.task.color}30`,
                color: st.task.color,
                filter: 'brightness(0.8)',
              }}
            >
              {st.task.category}
            </span>
          </div>
        )}

        {/* Done badge — replaces controls when done */}
        {st.done && isShort && (
          <span className="absolute inset-y-0 right-1 flex items-center text-[9px] font-bold text-brand-green opacity-0 group-hover:opacity-100 transition-opacity">
            ✓
          </span>
        )}
      </div>
    </div>
  );
});

export default WeekTaskBlock;
