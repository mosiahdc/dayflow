import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotificationSettings {
  taskRemindersEnabled: boolean;
  reminderMinutes: 5 | 10 | 15 | 30;
  dailyPlanningEnabled: boolean;
  dailyPlanningTime: string; // e.g. "08:00"
  habitRemindersEnabled: boolean;
  habitReminderTime: string; // e.g. "20:00"
  morningReminderEnabled: boolean;
  morningReminderTime: string; // e.g. "07:00"
}

interface NotificationStore extends NotificationSettings {
  update: (settings: Partial<NotificationSettings>) => void;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      taskRemindersEnabled: true,
      reminderMinutes: 5,
      dailyPlanningEnabled: false,
      dailyPlanningTime: '08:00',
      habitRemindersEnabled: false,
      habitReminderTime: '20:00',
      morningReminderEnabled: false,
      morningReminderTime: '07:00',
      update: (settings) => set(settings),
    }),
    { name: 'dayflow-notification-settings' }
  )
);
