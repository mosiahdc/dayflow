import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store/uiStore';
import type { View } from '@/types';
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
import DocumentsPage from '@/pages/documents';
import TradePage from '@/pages/trade';
import TimerOverlay from '@/components/planner/TimerOverlay';
import WeeklyReview from '@/components/planner/WeeklyReview';
import PublicReadingLog from '@/pages/reading-public';
import OfflineBanner from '@/components/OfflineBanner';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import type { Session } from '@supabase/supabase-js';

function AuthenticatedApp() {
  const {
    isDarkMode,
    activeView,
    setView,
    setDate,
    setWeekStart,
    setActiveMonth,
    toggleDark,
    docsNewBadge,
    dismissDocsBadge,
  } = useUIStore();
  const { needRefresh, updateServiceWorker } = useRegisterSW();

  useSupabaseRealtime();
  useOfflineSync();

  const desktopTabs: { view: View; label: string; badge?: boolean }[] = [
    { view: 'day', label: 'Day' },
    { view: 'week', label: 'Week' },
    { view: 'month', label: 'Month' },
    { view: 'analytics', label: '📊' },
    { view: 'habits', label: 'Habits' },
    { view: 'fasting', label: '🕐 Fast' },
    { view: 'documents', label: '📖 Read', badge: docsNewBadge },
    { view: 'library', label: '📚' },
    { view: 'trade', label: '📈 Trade' },
    { view: 'weekly_review', label: '📋 Review' },
    { view: 'settings', label: '⚙️' },
  ];

  const mainMobileTabs: { view: View; label: string; icon: string; badge?: boolean }[] = [
    { view: 'day', label: 'Day', icon: '📅' },
    { view: 'week', label: 'Week', icon: '📆' },
    { view: 'month', label: 'Month', icon: '🗓' },
  ];

  const moreMobileTabs: { view: View; label: string; icon: string; badge?: boolean }[] = [
    { view: 'habits', label: 'Habits', icon: '✅' },
    { view: 'fasting', label: 'Fast', icon: '⏱️' },
    { view: 'trade', label: 'Trade', icon: '📈' },
    { view: 'documents', label: 'Read', icon: '📖', badge: docsNewBadge },
    { view: 'weekly_review', label: 'Review', icon: '📋' },
  ];

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const moreIsActive = moreMobileTabs.some((t) => t.view === activeView);

  const handleNavClick = (view: View) => {
    setView(view);
    // Always jump back to today when clicking Day, Week, or Month
    if (view === 'day' || view === 'week' || view === 'month') {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const monthStr = `${yyyy}-${mm}`;
      setDate(todayStr);
      useUIStore.setState({ weekStart: todayStr, activeMonth: monthStr });
    }
    if (view === 'documents') dismissDocsBadge();
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--df-bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <OfflineBanner />
      {/* ── Desktop top nav ── */}
      <nav
        className="hidden md:flex items-center gap-2 px-4 py-2 border-b"
        style={{ background: 'var(--df-surface)', borderColor: 'var(--df-border)' }}
      >
        <span className="font-bold text-base text-white shrink-0 mr-2">DayFlow</span>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
          {desktopTabs.map(({ view, label, badge }) => (
            <button
              key={view}
              onClick={() => handleNavClick(view)}
              className="relative text-sm font-medium whitespace-nowrap px-3 py-1.5 rounded-md transition-all"
              style={{
                background: activeView === view ? 'var(--df-accent)' : 'var(--df-surface2)',
                color: activeView === view ? '#fff' : 'var(--df-muted)',
                border: `1px solid ${activeView === view ? 'var(--df-accent)' : 'var(--df-border)'}`,
              }}
            >
              {label}
              {badge && (
                <span
                  className="absolute -top-1.5 -right-1 text-white text-[8px] font-bold px-1 py-px rounded-sm leading-none"
                  style={{ background: 'var(--df-green)' }}
                >
                  NEW
                </span>
              )}
            </button>
          ))}
          {needRefresh[0] && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="text-xs px-2 py-1 rounded text-white whitespace-nowrap"
              style={{ background: 'var(--df-green)' }}
            >
              Update
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors hover:bg-white/10"
            style={{ color: 'var(--df-muted)' }}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors hover:bg-white/10"
            style={{ color: 'var(--df-muted)' }}
            title="Sign out"
          >
            🚪
          </button>
        </div>
      </nav>

      {/* ── Mobile top bar ── */}
      <div
        className="flex md:hidden items-center justify-between px-4 py-2.5 border-b"
        style={{ background: 'var(--df-surface)', borderColor: 'var(--df-border)' }}
      >
        <span className="font-bold text-base text-white">DayFlow</span>
        <div className="flex items-center gap-1">
          {(['analytics', 'library', 'notebook', 'settings'] as const).map((v) => (
            <button
              key={v}
              onClick={() => handleNavClick(v)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors"
              style={{
                background: activeView === v ? 'var(--df-accent)' : 'transparent',
                color: activeView === v ? '#fff' : 'var(--df-muted)',
              }}
            >
              {v === 'analytics' ? '📊' : v === 'library' ? '📚' : v === 'notebook' ? '📓' : '⚙️'}
            </button>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-8 h-8 flex items-center justify-center rounded-md text-sm"
            style={{ color: 'var(--df-muted)' }}
          >
            🚪
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      {activeView === 'documents' ? (
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 70px)' }}
        >
          <DocumentsPage />
        </main>
      ) : (
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
          {activeView === 'weekly_review' && <WeeklyReview />}
          {activeView === 'trade' && <TradePage />}
        </main>
      )}

      {/* ── Mobile bottom nav ── */}
      <div
        className="fixed bottom-0 left-0 right-0 md:hidden z-40 flex border-t"
        style={{
          background: 'var(--df-surface)',
          borderColor: 'var(--df-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {mainMobileTabs.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => {
              handleNavClick(view);
              setShowMoreSheet(false);
            }}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors"
            style={{ color: activeView === view ? 'var(--df-accent)' : 'var(--df-muted)' }}
          >
            <div
              className="w-8 h-7 rounded flex items-center justify-center text-base transition-all"
              style={{ background: activeView === view ? 'var(--df-accent)' : 'transparent' }}
            >
              {icon}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}

        {/* More button */}
        <button
          onClick={() => setShowMoreSheet((s) => !s)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors"
          style={{ color: moreIsActive || showMoreSheet ? 'var(--df-accent)' : 'var(--df-muted)' }}
        >
          <div
            className="w-8 h-7 rounded flex items-center justify-center text-base transition-all"
            style={{
              background: moreIsActive || showMoreSheet ? 'var(--df-accent)' : 'transparent',
            }}
          >
            {showMoreSheet ? '✕' : '⋯'}
          </div>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* ── More sheet ── */}
      {showMoreSheet && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowMoreSheet(false)}
          />
          {/* Sheet */}
          <div
            className="fixed left-0 right-0 md:hidden z-50"
            style={{
              bottom: 'calc(56px + env(safe-area-inset-bottom))',
              background: 'var(--df-surface)',
              borderTop: '1px solid var(--df-border)',
              borderRadius: '16px 16px 0 0',
              padding: '12px 16px 8px',
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--df-border)',
                margin: '0 auto 12px',
              }}
            />
            <p
              style={{
                fontSize: 11,
                color: 'var(--df-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              More
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {moreMobileTabs.map(({ view, label, icon, badge }) => (
                <button
                  key={view}
                  onClick={() => {
                    handleNavClick(view);
                    setShowMoreSheet(false);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 8px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background:
                      activeView === view ? 'rgba(79,110,247,0.15)' : 'var(--df-surface2)',
                    color: activeView === view ? 'var(--df-accent)' : 'var(--df-text)',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
                  {badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'var(--df-green)',
                        color: '#fff',
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      NEW
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <TimerOverlay />
    </div>
  );
}

export default function App() {
  const { isDarkMode } = useUIStore();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  // ── Public reading log route: /#/reading/<userId> ──────────────────────
  const hash = window.location.hash; // e.g. "#/reading/abc-123"
  const publicMatch = hash.match(/^#\/reading\/([^/?#]+)/);
  if (publicMatch) {
    return <PublicReadingLog userId={publicMatch[1]!} />;
  }

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
