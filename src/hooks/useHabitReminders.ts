import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useHabitStore } from '@/store/habitStore';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const isNotificationSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function useHabitReminders() {
  const { habits } = useHabitStore();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isNotificationSupported()) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    const check = () => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      const todayKey = DAY_KEYS[now.getDay() % 7]!;
      const todayStr = format(now, 'yyyy-MM-dd');
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const habit of habits) {
        if (!habit.reminderTime) continue;

        // Only fire on target days
        if (!habit.targetDays.includes(todayKey)) continue;

        // Check time match (HH:MM)
        if (habit.reminderTime !== currentTime) continue;

        // Deduplicate — only fire once per habit per day
        const key = `${habit.id}::${todayStr}::${habit.reminderTime}`;
        if (firedRef.current.has(key)) continue;

        firedRef.current.add(key);

        new Notification(`Time for ${habit.title}! ✅`, {
          body: `Don't forget your ${habit.category} habit today.`,
          icon: '/pwa-192x192.png',
          tag: key,
          requireInteraction: false,
        });
      }
    };

    // Check immediately, then every 30 seconds
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [habits]);
}
