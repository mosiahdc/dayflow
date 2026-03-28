/**
 * useOfflineSync — mounts once in App root
 *
 * - Listens to window online/offline events
 * - When coming back online, replays queued mutations against real stores
 * - Persisted queue survives page reloads
 */
import { useEffect, useCallback } from 'react';
import { useOfflineStore } from '@/store/offlineStore';
import { useHabitStore } from '@/store/habitStore';
import { usePlannerStore } from '@/store/plannerStore';

export function useOfflineSync() {
  const { setOnline, mutationQueue, dequeue, setLastSynced } = useOfflineStore();
  const habitStore = useHabitStore();
  const plannerStore = usePlannerStore();

  // ── Replay queued mutations ──────────────────────────────────────────────
  const replayQueue = useCallback(async () => {
    if (mutationQueue.length === 0) return;
    console.log(`[DayFlow offline] Replaying ${mutationQueue.length} queued mutations…`);

    for (const mutation of mutationQueue) {
      try {
        switch (mutation.type) {
          case 'toggleHabit':
            await habitStore.toggleEntry(
              mutation.payload.habitId as string,
              mutation.payload.date as string
            );
            break;
          case 'setSkipReason':
            await habitStore.setSkipReason(
              mutation.payload.habitId as string,
              mutation.payload.date as string,
              mutation.payload.reason as string
            );
            break;
          case 'toggleTask':
            await plannerStore.toggleDone(mutation.payload.id as string);
            break;
          case 'removeTask':
            await plannerStore.removeTask(mutation.payload.id as string);
            break;
          // addTask is more complex (needs taskId + date + slot), skip for safety
          default:
            break;
        }
        dequeue(mutation.id);
      } catch (err) {
        console.warn(`[DayFlow offline] Failed to replay mutation ${mutation.type}:`, err);
        // Leave in queue — will retry next time online
      }
    }
    setLastSynced();
  }, [mutationQueue, dequeue, setLastSynced, habitStore, plannerStore]);

  // ── Wire up window events ────────────────────────────────────────────────
  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      replayQueue();
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Replay on mount if we're online and there's a pending queue
    if (navigator.onLine && mutationQueue.length > 0) {
      replayQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
}
