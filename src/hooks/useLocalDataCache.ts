import { useEffect, useState } from 'react';
import { getLocalCache, setLocalCache } from '@/lib/localCache';
import { useTradeStore } from '@/store/tradeStore';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import { useTradeNotesStore } from '@/store/tradeNotesStore';
import { useTradeJournalStore } from '@/store/tradeJournalStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useFastingStore } from '@/store/fastingStore';
import { useTaskStore } from '@/store/taskStore';
import { usePriorityStore } from '@/store/priorityStore';
import { useDocumentStore } from '@/store/documentStore';
import { usePlantStore } from '@/store/plantStore';
import { useReflectionStore } from '@/store/reflectionStore';
import { useHighlightStore } from '@/store/highlightStore';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useReadingGoalStore } from '@/store/readingGoalStore';
import { useTaskHoursStore } from '@/store/taskHoursStore';
import { useTemplateStore } from '@/store/templateStore';

const KEYS = {
  trades: 'state:trades:v1',
  tradeSettings: 'state:trade-settings:v1',
  tradeNotes: 'state:trade-notes:v1',
  tradeJournal: 'state:trade-journal:v1',
  planner: 'state:planner:v1',
  habits: 'state:habits:v1',
  fasting: 'state:fasting:v1',
  tasks: 'state:tasks:v1',
  priority: 'state:priority:v1',
  documents: 'state:documents:v1',
  plants: 'state:plants:v1',
  reflections: 'state:reflections:v1',
  highlights: 'state:highlights:v1',
  bookmarks: 'state:bookmarks:v1',
  readingGoal: 'state:reading-goal:v1',
  taskHours: 'state:task-hours:v1',
  templates: 'state:templates:v1',
} as const;

type TimerMap = Map<string, ReturnType<typeof setTimeout>>;

/**
 * Hydrates the major Zustand stores from IndexedDB before page components mount.
 * Store changes are then written back with a short debounce. Supabase remains the
 * source of truth; this cache exists only to avoid blank/loading screens on reopen.
 */
export function useLocalDataCache(userId: string): boolean {
  const [readyUserId, setReadyUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: TimerMap = new Map();
    const unsubs: Array<() => void> = [];

    const schedule = (key: string, snapshot: () => unknown) => {
      const current = timers.get(key);
      if (current) clearTimeout(current);
      timers.set(
        key,
        setTimeout(() => {
          void setLocalCache(userId, key, snapshot());
          timers.delete(key);
        }, 250)
      );
    };

    const hydrate = async () => {
      const [
        trades,
        tradeSettings,
        tradeNotes,
        tradeJournal,
        planner,
        habits,
        fasting,
        tasks,
        priority,
        documents,
        plants,
        reflections,
        highlights,
        bookmarks,
        readingGoal,
        taskHours,
        templates,
      ] = await Promise.all([
        getLocalCache<any>(userId, KEYS.trades),
        getLocalCache<any>(userId, KEYS.tradeSettings),
        getLocalCache<any>(userId, KEYS.tradeNotes),
        getLocalCache<any>(userId, KEYS.tradeJournal),
        getLocalCache<any>(userId, KEYS.planner),
        getLocalCache<any>(userId, KEYS.habits),
        getLocalCache<any>(userId, KEYS.fasting),
        getLocalCache<any>(userId, KEYS.tasks),
        getLocalCache<any>(userId, KEYS.priority),
        getLocalCache<any>(userId, KEYS.documents),
        getLocalCache<any>(userId, KEYS.plants),
        getLocalCache<any>(userId, KEYS.reflections),
        getLocalCache<any>(userId, KEYS.highlights),
        getLocalCache<any>(userId, KEYS.bookmarks),
        getLocalCache<any>(userId, KEYS.readingGoal),
        getLocalCache<any>(userId, KEYS.taskHours),
        getLocalCache<any>(userId, KEYS.templates),
      ]);

      if (cancelled) return;

      if (Array.isArray(trades)) useTradeStore.setState({ trades, loading: false });
      if (tradeSettings) useTradeSettingsStore.setState({ ...tradeSettings, loading: false });
      if (tradeNotes?.notes) useTradeNotesStore.setState({ notes: tradeNotes.notes, loading: false });
      if (tradeJournal) useTradeJournalStore.setState({ ...tradeJournal, loading: false });
      if (planner?.scheduledTasks) usePlannerStore.setState({ scheduledTasks: planner.scheduledTasks, loading: false });
      if (habits) useHabitStore.setState(habits);
      if (fasting) useFastingStore.setState({ ...fasting, loading: false });
      if (tasks?.tasks) useTaskStore.setState({ tasks: tasks.tasks, loading: false });
      if (priority?.items) usePriorityStore.setState({ items: priority.items });
      if (documents?.documents) useDocumentStore.setState({ documents: documents.documents, loading: false });
      if (plants?.plants) usePlantStore.setState({ plants: plants.plants, loading: false });
      if (reflections?.reflections) useReflectionStore.setState({ reflections: reflections.reflections });
      if (highlights?.highlights) useHighlightStore.setState({ highlights: highlights.highlights, loading: false });
      if (bookmarks?.byDoc) useBookmarkStore.setState({ byDoc: bookmarks.byDoc });
      if (readingGoal && Object.prototype.hasOwnProperty.call(readingGoal, 'goal')) useReadingGoalStore.setState({ goal: readingGoal.goal });
      if (taskHours?.targets) useTaskHoursStore.setState({ targets: taskHours.targets, loading: false });
      if (templates?.templates) useTemplateStore.setState({ templates: templates.templates });

      // Subscribe only after hydration, otherwise the initial empty stores would overwrite cache.
      unsubs.push(
        useTradeStore.subscribe((s) => schedule(KEYS.trades, () => s.trades)),
        useTradeSettingsStore.subscribe((s) => schedule(KEYS.tradeSettings, () => ({ initialBalance: s.initialBalance, transactions: s.transactions }))),
        useTradeNotesStore.subscribe((s) => schedule(KEYS.tradeNotes, () => ({ notes: s.notes }))),
        useTradeJournalStore.subscribe((s) => schedule(KEYS.tradeJournal, () => ({ entries: s.entries, assessments: s.assessments }))),
        usePlannerStore.subscribe((s) => schedule(KEYS.planner, () => ({ scheduledTasks: s.scheduledTasks }))),
        useHabitStore.subscribe((s) => schedule(KEYS.habits, () => ({ habits: s.habits, entries: s.entries, weekEntries: s.weekEntries }))),
        useFastingStore.subscribe((s) => schedule(KEYS.fasting, () => ({ sessions: s.sessions, active: s.active }))),
        useTaskStore.subscribe((s) => schedule(KEYS.tasks, () => ({ tasks: s.tasks }))),
        usePriorityStore.subscribe((s) => schedule(KEYS.priority, () => ({ items: s.items }))),
        useDocumentStore.subscribe((s) => schedule(KEYS.documents, () => ({ documents: s.documents }))),
        usePlantStore.subscribe((s) => schedule(KEYS.plants, () => ({ plants: s.plants }))),
        useReflectionStore.subscribe((s) => schedule(KEYS.reflections, () => ({ reflections: s.reflections }))),
        useHighlightStore.subscribe((s) => schedule(KEYS.highlights, () => ({ highlights: s.highlights }))),
        useBookmarkStore.subscribe((s) => schedule(KEYS.bookmarks, () => ({ byDoc: s.byDoc }))),
        useReadingGoalStore.subscribe((s) => schedule(KEYS.readingGoal, () => ({ goal: s.goal }))),
        useTaskHoursStore.subscribe((s) => schedule(KEYS.taskHours, () => ({ targets: s.targets }))),
        useTemplateStore.subscribe((s) => schedule(KEYS.templates, () => ({ templates: s.templates })))
      );

      setReadyUserId(userId);
    };

    void hydrate();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [userId]);

  return readyUserId === userId;
}
