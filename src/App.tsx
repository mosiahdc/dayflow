import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store/uiStore';
import Auth from '@/components/Auth';
import DayPage from '@/pages/index';
import WeekPage from '@/pages/week';
import MonthPage from '@/pages/month';
import type { Session } from '@supabase/supabase-js';

export default function App() {
  const { isDarkMode, activeView, setView, toggleDark } = useUIStore();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <p className="text-brand-muted">Loading…</p>
    </div>
  );

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-brand-bg dark:bg-brand-dark">
      <nav className="bg-brand-dark text-white px-4 py-2 flex items-center justify-between">
        <span className="font-bold text-lg">DayFlow</span>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-sm capitalize transition-colors
                ${activeView === v ? 'bg-brand-accent' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleDark} className="text-sm text-gray-400 hover:text-white">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-gray-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="p-4">
        {activeView === 'day' && <DayPage />}
        {activeView === 'week' && <WeekPage />}
        {activeView === 'month' && <MonthPage />}
      </main>
    </div>
  );
}