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
  | 'trade'
  | 'documents'
  | 'notebook';

export interface PendingDocOpen {
  documentId: string;
  page: number | null;
  spineIndex: number | null;
}

export interface UIStore {
  activeView: View;
  selectedDate: string;
  weekStart: string;
  activeMonth: string;
  timerTaskId: string | null;
  isDarkMode: boolean;
  sidebarOpen: boolean;
  docsBadge: boolean;
  pendingDocOpen: PendingDocOpen | null;
  setView: (view: View) => void;
  setDate: (date: string) => void;
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
      docsBadge: false,
      pendingDocOpen: null,
      setView: (activeView) => set({ activeView }),
      setDate: (selectedDate) => set({ selectedDate }),
      setTimerTask: (timerTaskId) => set({ timerTaskId }),
      toggleDark: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
      dismissDocsBadge: () => set({ docsBadge: false }),
      openDocAt: (documentId, page, spineIndex) =>
        set({ pendingDocOpen: { documentId, page, spineIndex }, activeView: 'documents' }),
      clearPendingDocOpen: () => set({ pendingDocOpen: null }),
    }),
    { name: 'dayflow-ui' }
  )
);
