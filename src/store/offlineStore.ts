/**
 * offlineStore — lightweight offline support layer
 *
 * Strategy:
 * - Persists plannerStore, habitStore snapshots to localStorage via zustand/persist
 * - Tracks online/offline status
 * - Queues mutations when offline, replays when connection restores
 * - Works on top of the existing Supabase + Workbox PWA setup
 *
 * No architecture change needed — existing stores stay unchanged.
 * This store wraps them with an extra persistence + queue layer.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MutationType =
  | 'toggleHabit'
  | 'setSkipReason'
  | 'toggleTask'
  | 'addTask'
  | 'removeTask';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface OfflineStore {
  isOnline: boolean;
  mutationQueue: QueuedMutation[];
  lastSyncedAt: string | null;

  // Actions
  setOnline: (v: boolean) => void;
  enqueue: (type: MutationType, payload: Record<string, unknown>) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;
  setLastSynced: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      mutationQueue: [],
      lastSyncedAt: null,

      setOnline: (v) => set({ isOnline: v }),

      enqueue: (type, payload) =>
        set((s) => ({
          mutationQueue: [
            ...s.mutationQueue,
            {
              id: crypto.randomUUID(),
              type,
              payload,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      dequeue: (id) =>
        set((s) => ({
          mutationQueue: s.mutationQueue.filter((m) => m.id !== id),
        })),

      clearQueue: () => set({ mutationQueue: [] }),

      setLastSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
    }),
    {
      name: 'dayflow-offline',
      partialize: (s) => ({
        mutationQueue: s.mutationQueue,
        lastSyncedAt: s.lastSyncedAt,
      }),
    }
  )
);
