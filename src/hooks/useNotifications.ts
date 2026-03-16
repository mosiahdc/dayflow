import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useNotificationStore } from '@/store/notificationStore';
import { format, parseISO } from 'date-fns';

const isNative = Capacitor.isNativePlatform();

const isWebNotificationSupported = () => typeof window !== 'undefined' && 'Notification' in window;

async function requestPermission() {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } else if (isWebNotificationSupported()) {
    if ((window as any).Notification.permission === 'default') {
      const result = await (window as any).Notification.requestPermission();
      return result === 'granted';
    }
    return (window as any).Notification.permission === 'granted';
  }
  return false;
}

// Stable numeric id from a string key
function hashId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2_000_000_000;
}

// Build a Date from a date string + hour + minute
function buildDate(dateStr: string, hours: number, minutes: number): Date {
  const d = parseISO(dateStr);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// Parse "HH:MM" into { hours, minutes }
function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

export function useNotifications(date: string) {
  const { scheduledTasks } = usePlannerStore();
  const { habits } = useHabitStore();
  const {
    taskRemindersEnabled,
    reminderMinutes,
    dailyPlanningEnabled,
    dailyPlanningTime,
    habitRemindersEnabled,
    habitReminderTime,
    morningReminderEnabled,
    morningReminderTime,
  } = useNotificationStore();

  useEffect(() => {
    // Only pre-schedule on native Android/iOS
    // On web, fall back to a simple interval-based approach
    if (!isNative) {
      webFallback();
      return;
    }

    scheduleAll().catch(console.error);
  }, [
    date,
    scheduledTasks,
    habits,
    taskRemindersEnabled,
    reminderMinutes,
    dailyPlanningEnabled,
    dailyPlanningTime,
    habitRemindersEnabled,
    habitReminderTime,
    morningReminderEnabled,
    morningReminderTime,
  ]);

  // ── Native: cancel old + schedule all upcoming notifications ──────────
  async function scheduleAll() {
    const granted = await requestPermission();
    if (!granted) return;

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Cancel all previously scheduled DayFlow notifications
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const toSchedule: {
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
    }[] = [];

    // ── Task reminders ─────────────────────────────────────────────────
    if (taskRemindersEnabled) {
      for (const st of scheduledTasks.filter((t) => t.date >= todayStr && !t.done)) {
        const taskHour = Math.floor(st.startSlot / 2);
        const taskMin = st.startSlot % 2 === 0 ? 0 : 30;

        // "X minutes before" reminder
        const reminderAt = buildDate(st.date, taskHour, taskMin - reminderMinutes);
        if (reminderAt > now) {
          toSchedule.push({
            id: hashId(`remind-${reminderMinutes}-${st.id}`),
            title: '⏰ DayFlow Reminder',
            body: `"${st.task.title}" starts in ${reminderMinutes} minute${reminderMinutes > 1 ? 's' : ''}`,
            schedule: { at: reminderAt },
          });
        }

        // "Starting now" notification
        const startAt = buildDate(st.date, taskHour, taskMin);
        if (startAt > now) {
          toSchedule.push({
            id: hashId(`now-${st.id}`),
            title: '🚀 DayFlow — Starting Now',
            body: `"${st.task.title}" is starting now!`,
            schedule: { at: startAt },
          });
        }
      }
    }

    // ── Morning reminder ───────────────────────────────────────────────
    if (morningReminderEnabled) {
      const { hours, minutes } = parseTime(morningReminderTime);
      for (const offset of [0, 1]) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        const morningAt = new Date(d);
        morningAt.setHours(hours, minutes, 0, 0);
        if (morningAt > now) {
          const dayStr = format(morningAt, 'yyyy-MM-dd');
          const dayTaskCount = scheduledTasks.filter((t) => t.date === dayStr).length;
          toSchedule.push({
            id: hashId(`morning-${dayStr}`),
            title: '🌅 Good Morning!',
            body:
              dayTaskCount > 0
                ? `You have ${dayTaskCount} task${dayTaskCount > 1 ? 's' : ''} planned today. Let's go!`
                : 'Good morning! Open DayFlow to plan your day.',
            schedule: { at: morningAt },
          });
          break;
        }
      }
    }

    // ── Daily planning reminder ────────────────────────────────────────
    if (dailyPlanningEnabled) {
      const { hours, minutes } = parseTime(dailyPlanningTime);
      // Schedule for today and tomorrow
      for (const offset of [0, 1]) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        const planAt = new Date(d);
        planAt.setHours(hours, minutes, 0, 0);
        if (planAt > now) {
          const dayStr = format(planAt, 'yyyy-MM-dd');
          toSchedule.push({
            id: hashId(`planning-${dayStr}`),
            title: '📅 Plan Your Day',
            body: 'Good morning! Time to plan your tasks for today.',
            schedule: { at: planAt },
          });
          break; // only need the next upcoming one
        }
      }
    }

    // ── Habit reminder ─────────────────────────────────────────────────
    if (habitRemindersEnabled && habits.length > 0) {
      const { hours, minutes } = parseTime(habitReminderTime);
      for (const offset of [0, 1]) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        const habitAt = new Date(d);
        habitAt.setHours(hours, minutes, 0, 0);
        if (habitAt > now) {
          const dayStr = format(habitAt, 'yyyy-MM-dd');
          toSchedule.push({
            id: hashId(`habits-${dayStr}`),
            title: '✅ Habit Check-in',
            body: "Don't forget to log your habits for today!",
            schedule: { at: habitAt },
          });
          break;
        }
      }
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  }

  // ── Web fallback: simple interval check ───────────────────────────────
  function webFallback() {
    if (!isWebNotificationSupported()) return;

    requestPermission().catch(console.error);

    const notified = new Set<string>();

    const check = () => {
      if ((window as any).Notification?.permission !== 'granted') return;

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      if (todayStr !== date) return;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (const st of scheduledTasks.filter((t) => t.date === date && !t.done)) {
        const taskMinutes = Math.floor(st.startSlot / 2) * 60 + (st.startSlot % 2 === 0 ? 0 : 30);
        const minutesUntil = taskMinutes - currentMinutes;

        const keyR = `remind-${reminderMinutes}-${st.id}`;
        const keyN = `now-${st.id}`;

        if (minutesUntil <= reminderMinutes && minutesUntil > 0 && !notified.has(keyR)) {
          notified.add(keyR);
          new (window as any).Notification('⏰ DayFlow Reminder', {
            body: `"${st.task.title}" starts in ${minutesUntil} minute${minutesUntil > 1 ? 's' : ''}`,
            icon: '/pwa-192x192.png',
          });
        }

        if (minutesUntil <= 0 && minutesUntil > -2 && !notified.has(keyN)) {
          notified.add(keyN);
          new (window as any).Notification('🚀 DayFlow — Starting Now', {
            body: `"${st.task.title}" is starting now!`,
            icon: '/pwa-192x192.png',
          });
        }
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }
}
