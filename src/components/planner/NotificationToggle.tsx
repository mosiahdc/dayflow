import { useState, useEffect } from 'react';

const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export default function NotificationToggle() {
  // SAFE: never access Notification.permission at render/module time — crashes Android WebView
  // Initialize to 'denied' and read the real value inside useEffect only
  const [permission, setPermission] = useState<NotificationPermission>('denied');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;
    setSupported(true);
    setPermission(Notification.permission);

    const interval = setInterval(() => {
      setPermission(Notification.permission);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Hide entirely on Android WebView (Notification API unavailable)
  if (!supported) return null;

  const request = async () => {
    if (!isNotificationSupported()) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (permission === 'granted') {
    return (
      <span className="text-xs text-brand-green flex items-center gap-1" title="Notifications enabled">
        🔔
      </span>
    );
  }

  if (permission === 'denied') {
    return (
      <span
        className="text-xs text-brand-muted flex items-center gap-1"
        title="Notifications blocked — enable in browser settings"
      >
        🔕
      </span>
    );
  }

  return (
    <button
      onClick={request}
      className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white"
      title="Enable notifications"
    >
      🔔 Enable alerts
    </button>
  );
}