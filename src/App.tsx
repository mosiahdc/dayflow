import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store/uiStore';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Auth from '@/components/Auth';
import DayPage from '@/pages/index';
import WeekPage from '@/pages/week';
import MonthPage from '@/pages/month';
import AnalyticsPage from '@/pages/analytics';
import HabitsPage from '@/pages/habits';
import FastingPage from '@/pages/fasting';
import SettingsPage from '@/pages/settings';
import LibraryPage from '@/pages/library';
import TimerOverlay from '@/components/planner/TimerOverlay';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import type { Session } from '@supabase/supabase-js';

// Inner component so hooks run only after session is confirmed
function AuthenticatedApp() {
  const { isDarkMode, activeView, setView, toggleDark } = useUIStore();
  const { needRefresh, updateServiceWorker } = useRegisterSW();

  // Enable live multi-device sync
  useSupabaseRealtime();

  // Desktop nav — all tabs
  const desktopTabs = [
    { view: 'day', label: 'Day' },
    { view: 'week', label: 'Week' },
    { view: 'month', label: 'Month' },
    { view: 'analytics', label: '📊' },
    { view: 'habits', label: 'Habits' },
    { view: 'fasting', label: '🕐 Fast' },
    { view: 'library', label: '📚' },
    { view: 'settings', label: '⚙️' },
  ] as const;

  // Mobile bottom nav
  const mobileTabs = [
    { view: 'day', label: 'Day', icon: '📅' },
    { view: 'week', label: 'Week', icon: '📆' },
    { view: 'month', label: 'Month', icon: '🗓' },
    { view: 'habits', label: 'Habits', icon: '✅' },
    { view: 'fasting', label: 'Fast', icon: '🕐' },
  ] as const;

  return (
    <div
      className="min-h-screen bg-brand-bg dark:bg-brand-dark flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ── Desktop top nav ── */}
      <nav className="bg-brand-dark text-white px-3 py-2 hidden md:flex items-center justify-between gap-2">
        <span className="font-bold text-base shrink-0">DayFlow</span>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 justify-center">
          {desktopTabs.map(({ view, label }) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap
                ${activeView === view ? 'bg-brand-accent' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {label}
            </button>
          ))}
          {needRefresh[0] && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="text-xs bg-brand-green px-2 py-1 rounded text-white whitespace-nowrap"
            >
              Update
            </button>
          )}
        </div>

        <button
          onClick={toggleDark}
          className="text-lg text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center shrink-0"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </nav>

      {/* ── Mobile top bar ── */}
      <div className="bg-brand-dark text-white px-3 py-2 flex md:hidden items-center justify-between">
        <span className="font-bold text-base">DayFlow</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('analytics')}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm
              ${activeView === 'analytics' ? 'bg-brand-accent' : 'text-gray-400'}`}
          >
            📊
          </button>
          <button
            onClick={() => setView('library')}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm
              ${activeView === 'library' ? 'bg-brand-accent' : 'text-gray-400'}`}
          >
            📚
          </button>
          <button
            onClick={toggleDark}
            className="text-lg text-gray-400 w-8 h-8 flex items-center justify-center"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => setView('settings')}
            className={`text-lg w-8 h-8 flex items-center justify-center rounded transition-colors
              ${activeView === 'settings' ? 'bg-brand-accent' : 'text-gray-400'}`}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <main
        className="flex-1 p-3 overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 70px)' }}
      >
        {activeView === 'day' && <DayPage />}
        {activeView === 'week' && <WeekPage />}
        {activeView === 'month' && <MonthPage />}
        {activeView === 'analytics' && <AnalyticsPage />}
        {activeView === 'habits' && <HabitsPage />}
        {activeView === 'fasting' && <FastingPage />}
        {activeView === 'library' && <LibraryPage />}
        {activeView === 'settings' && <SettingsPage />}
      </main>

      {/* ── Mobile bottom nav ── */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-brand-dark md:hidden z-40 flex border-t border-gray-700"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {mobileTabs.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
              ${activeView === view ? 'text-brand-accent' : 'text-gray-400'}`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Floating timer — always rendered above everything ── */}
      <TimerOverlay />
    </div>
  );
}

export default function App() {
  const { isDarkMode } = useUIStore();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  if (checking)
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <p className="text-brand-muted">Loading…</p>
      </div>
    );

  if (!session) return <Auth />;

  return <AuthenticatedApp />;
}
