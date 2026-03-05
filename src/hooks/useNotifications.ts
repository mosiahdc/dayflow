import { useEffect, useRef, useCallback } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { format } from 'date-fns';

// Android WebView does NOT support the browser Notification API.
// Always check before accessing window.Notification.
const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

function getPermission(): boolean {
  return isNotificationSupported() && Notification.permission === 'granted';
}

export function useNotifications(date: string) {
  const { scheduledTasks } = usePlannerStore();
  const notifiedRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (!isNotificationSupported()) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Skip entirely on Android / any platform without Notification API
    if (!isNotificationSupported()) return;

    requestPermission();

    const check = () => {
      if (!getPermission()) return;

      const now      = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      if (todayStr !== date) return;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      scheduledTasks
        .filter((st) => st.date === date && !st.done)
        .forEach((st) => {
          const taskMinutes =
            Math.floor(st.startSlot / 2) * 60 + (st.startSlot % 2 === 0 ? 0 : 30);
          const minutesUntil = taskMinutes - currentMinutes;

          const key5 = `5min-${st.id}`;
          const key0 = `now-${st.id}`;

          if (minutesUntil <= 5 && minutesUntil > 0 && !notifiedRef.current.has(key5)) {
            notifiedRef.current.add(key5);
            new Notification('⏰ DayFlow Reminder', {
              body: `"${st.task.title}" starts in ${minutesUntil} minute${minutesUntil > 1 ? 's' : ''}`,
              icon: '/pwa-192x192.png',
              tag:  key5,
            });
          }

          if (minutesUntil <= 0 && minutesUntil > -2 && !notifiedRef.current.has(key0)) {
            notifiedRef.current.add(key0);
            new Notification('🚀 DayFlow — Starting Now', {
              body: `"${st.task.title}" is starting now!`,
              icon: '/pwa-192x192.png',
              tag:  key0,
            });
          }
        });
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [date, scheduledTasks, requestPermission]);
}