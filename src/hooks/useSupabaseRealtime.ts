import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useTaskStore } from '@/store/taskStore';
import { usePriorityStore } from '@/store/priorityStore';
import { useTradeStore } from '@/store/tradeStore';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import { useTradeNotesStore } from '@/store/tradeNotesStore';
import { useTradeJournalStore } from '@/store/tradeJournalStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * useSupabaseRealtime
 *
 * Subscribes to Supabase realtime channels for all major tables.
 * When another device inserts, updates, or deletes a row, the local
 * Zustand store is refreshed automatically — no manual polling needed.
 *
 * Mount once at the top of the app (inside App.tsx, after session check).
 * The hook cleans up all subscriptions on unmount.
 *
 * Requirements: enable Realtime for these tables in your Supabase project:
 *   scheduled_tasks, tasks, habit_entries, priority_items
 */
export function useSupabaseRealtime() {
  const { fetchByDate, fetchByWeek, scheduledTasks } = usePlannerStore();
  const { fetchHabits, fetchAllEntries } = useHabitStore();
  const { fetchAll: fetchTasks } = useTaskStore();
  const { fetchAll: fetchPriority } = usePriorityStore();
  const { fetchTrades } = useTradeStore();
  const { fetchSettings: fetchTradeSettings } = useTradeSettingsStore();
  const { fetchNotes } = useTradeNotesStore();
  const { fetchJournal } = useTradeJournalStore();

  // Track the currently visible date range so we can re-fetch only what's on screen
  const visibleDatesRef = useRef<{
    date: string | undefined;
    start: string | undefined;
    end: string | undefined;
  }>({ date: undefined, start: undefined, end: undefined });

  // Update visible range when the planner store changes
  useEffect(() => {
    const dates = [...new Set(scheduledTasks.map((t) => t.date))].sort();
    if (dates.length > 0) {
      visibleDatesRef.current = {
        date: dates[dates.length - 1] ?? undefined,
        start: dates[0] ?? undefined,
        end: dates[dates.length - 1] ?? undefined,
      };
    }
  }, [scheduledTasks]);

  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    // ── scheduled_tasks ────────────────────────────────────────────────────
    const plannerChannel = supabase
      .channel('realtime:scheduled_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tasks' }, () => {
        const { date, start, end } = visibleDatesRef.current;
        if (start && end) {
          fetchByWeek(start, end);
        } else if (date) {
          fetchByDate(date);
        }
      })
      .subscribe();
    channels.push(plannerChannel);

    // ── tasks (library) ────────────────────────────────────────────────────
    const taskChannel = supabase
      .channel('realtime:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();
    channels.push(taskChannel);

    // ── habit_entries ──────────────────────────────────────────────────────
    const habitEntryChannel = supabase
      .channel('realtime:habit_entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_entries' }, () => {
        fetchAllEntries();
      })
      .subscribe();
    channels.push(habitEntryChannel);

    // ── habits ─────────────────────────────────────────────────────────────
    const habitChannel = supabase
      .channel('realtime:habits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, () => {
        fetchHabits();
      })
      .subscribe();
    channels.push(habitChannel);

    // ── priority_items ─────────────────────────────────────────────────────
    const priorityChannel = supabase
      .channel('realtime:priority_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'priority_items' }, () => {
        fetchPriority();
      })
      .subscribe();
    channels.push(priorityChannel);

    // ── trading data ───────────────────────────────────────────────────────
    // Inserts can use the cheap incremental trade sync. Updates/deletes force a
    // reconciliation because created_at alone cannot describe removed rows.
    const tradesChannel = supabase
      .channel('realtime:trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        void fetchTrades(payload.eventType !== 'INSERT');
      })
      .subscribe();
    channels.push(tradesChannel);

    const tradeTxChannel = supabase
      .channel('realtime:trade_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_transactions' }, () => {
        void fetchTradeSettings();
      })
      .subscribe();
    channels.push(tradeTxChannel);

    const tradeNotesChannel = supabase
      .channel('realtime:trade_notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_notes' }, () => {
        void fetchNotes();
      })
      .subscribe();
    channels.push(tradeNotesChannel);

    const journalEntriesChannel = supabase
      .channel('realtime:trade_journal_entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_journal_entries' }, () => {
        void fetchJournal();
      })
      .subscribe();
    channels.push(journalEntriesChannel);

    const journalAssessmentsChannel = supabase
      .channel('realtime:trade_journal_assessments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_journal_assessments' }, () => {
        void fetchJournal();
      })
      .subscribe();
    channels.push(journalAssessmentsChannel);

    // Cleanup — remove all channels on unmount
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [fetchByDate, fetchByWeek, fetchTasks, fetchAllEntries, fetchHabits, fetchPriority, fetchTrades, fetchTradeSettings, fetchNotes, fetchJournal]);
}
