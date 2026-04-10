import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';

export type View =
  | 'day'
  | 'week'
  | 'month'
  | 'analytics'
  | 'habits'
  | 'fasting'
  | 'library'
  | 'settings'
  | 'documents'
  | 'notebook'
  | 'weekly_review'
  | 'trade';

interface UIStore {
  activeView: View;
  selectedDate: string;
  weekStart: string;
  activeMonth: string;
  timerTaskId: string | null;
  isDarkMode: boolean;
  sidebarOpen: boolean;
  docsNewBadge: boolean;
  pendingDocOpen: { documentId: string; page: number | null; spineIndex: number | null } | null;
  setView: (view: View) => void;
  setDate: (date: string) => void;
  setWeekStart: (date: string) => void;
  setActiveMonth: (month: string) => void;
  setTimerTask: (id: string | null) => void;
  toggleDark: () => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  dismissDocsBadge: () => void;
  openDocAt: (documentId: string, page: number | null, spineIndex: number | null) => void;
  clearPendingDocOpen: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      activeView: 'day',
      selectedDate: format(new Date(), 'yyyy-MM-dd'),
      weekStart: format(new Date(), 'yyyy-MM-dd'),
      activeMonth: format(new Date(), 'yyyy-MM'),
      timerTaskId: null,
      isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
      sidebarOpen: true,
      docsNewBadge: true,
      pendingDocOpen: null,
      setView: (activeView) => set({ activeView }),
      setDate: (selectedDate) => set({ selectedDate }),
      setWeekStart: (weekStart) => set({ weekStart }),
      setActiveMonth: (activeMonth) => set({ activeMonth }),
      setTimerTask: (timerTaskId) => set({ timerTaskId }),
      toggleDark: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
      dismissDocsBadge: () => set({ docsNewBadge: false }),
      openDocAt: (documentId, page, spineIndex) =>
        set({ activeView: 'documents', pendingDocOpen: { documentId, page, spineIndex } }),
      clearPendingDocOpen: () => set({ pendingDocOpen: null }),
    }),
    { name: 'dayflow-ui' }
  )
);
