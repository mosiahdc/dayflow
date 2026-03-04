import { useEffect } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { usePlannerStore } from '@/store/plannerStore';
import { shouldRecurOnDate } from '@/lib/recurring';

export function useRecurring(date: string) {
  const { tasks }    = useTaskStore();
  const { scheduledTasks, addTask } = usePlannerStore();

  useEffect(() => {
    const recurringTasks = tasks.filter((t) => t.recurring.type !== 'none');
    if (!recurringTasks.length) return;

    for (const task of recurringTasks) {
      if (!shouldRecurOnDate(task, date)) continue;

      // Check if already scheduled on this date
      const alreadyScheduled = scheduledTasks.some(
        (st) => st.taskId === task.id && st.date === date
      );
      if (alreadyScheduled) continue;

      // Schedule at first available slot (8am = slot 16 default)
      const usedSlots = scheduledTasks
        .filter((st) => st.date === date)
        .map((st) => st.startSlot);

      let slot = 16;
      while (usedSlots.includes(slot)) slot++;

      addTask(task.id, date, slot);
    }
  }, [date, tasks]);
}