import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store/uiStore';
import type { View } from '@/types';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { Session } from '@supabase/supabase-js';
import Auth from '@/components/Auth';
import HomePage from '@/pages/home';
import PlannerPage from '@/pages/planner';
import AnalyticsPage from '@/pages/analytics';
import HabitsPage from '@/pages/habits';
import FastingPage from '@/pages/fasting';
import SettingsPage from '@/pages/settings';
import LibraryPage from '@/pages/library';
import DocumentsPage from '@/pages/documents';
import TradePage from '@/pages/trade';
import PlantsPage from '@/pages/plants';
import TimerOverlay from '@/components/planner/TimerOverlay';
import WeeklyReview from '@/components/planner/WeeklyReview';
import PublicReadingLog from '@/pages/reading-public';
import OfflineBanner from '@/components/OfflineBanner';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';

type NavItem = {
  view: View;
  label: string;
  short?: string;
  icon: 'home' | 'calendar' | 'check' | 'timer' | 'book' | 'review' | 'chart' | 'trade' | 'plant' | 'library' | 'settings';
  badge?: boolean;
};

const PAGE_META: Partial<Record<View, { title: string; subtitle: string }>> = {
  home: { title: 'Home', subtitle: 'A clear view of your day, momentum, and priorities.' },
  day: { title: 'Planner', subtitle: 'Shape your time before the day shapes it for you.' },
  week: { title: 'Planner', subtitle: 'See the week as one connected plan.' },
  month: { title: 'Planner', subtitle: 'Zoom out, spot patterns, and make space for what matters.' },
  habits: { title: 'Habits', subtitle: 'Small actions, repeated with intention.' },
  fasting: { title: 'Fast', subtitle: 'Track fasting windows without losing sight of the bigger picture.' },
  documents: { title: 'Read', subtitle: 'Turn reading into a consistent learning system.' },
  library: { title: 'Task Library', subtitle: 'Reusable building blocks for your days.' },
  weekly_review: { title: 'Review', subtitle: 'Reflect on the week, keep the lessons, plan the next one.' },
  analytics: { title: 'Insights', subtitle: 'Understand your patterns across planning, habits, fasting, and progress.' },
  trade: { title: 'Trading Journey', subtitle: 'Track decisions, risk, performance, and execution discipline.' },
  plants: { title: 'Plants', subtitle: 'Simple care tracking for the things you grow.' },
  settings: { title: 'Settings', subtitle: 'Control reminders, preferences, imports, and app behaviour.' },
};

function NavIcon({ name }: { name: NavItem['icon'] }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<NavItem['icon'], React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    check: <><path d="M9 11l2 2 4-5"/><circle cx="12" cy="12" r="9"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23z"/></>,
    review: <><path d="M7 3h10v4H7z"/><path d="M5 5v16h14V5M8 11h8M8 15h5"/></>,
    chart: <><path d="M4 19V9M10 19V4M16 19v-7M22 19V7"/></>,
    trade: <><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></>,
    plant: <><path d="M12 21v-9"/><path d="M12 13c-5 0-7-3-7-7 5 0 7 3 7 7Z"/><path d="M12 10c0-4 2-7 7-7 0 4-2 7-7 7Z"/></>,
    library: <><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l4-1 3 15-4 1z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6H3A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.37.37.7.6 1 .27.25.62.4 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6.6Z"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function AuthenticatedApp({ session }: { session: Session }) {
  const { isDarkMode, activeView, setView, setDate, toggleDark, docsNewBadge, dismissDocsBadge } = useUIStore();
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const [mobileMore, setMobileMore] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useSupabaseRealtime();
  useOfflineSync();

  const isPlannerView = (v: View) => v === 'day' || v === 'week' || v === 'month';

  const primaryNav: NavItem[] = [
    { view: 'home', label: 'Home', icon: 'home' },
    { view: 'day', label: 'Planner', icon: 'calendar' },
    { view: 'habits', label: 'Habits', icon: 'check' },
    { view: 'fasting', label: 'Fast', icon: 'timer' },
    { view: 'documents', label: 'Read', icon: 'book', badge: docsNewBadge },
    { view: 'weekly_review', label: 'Review', icon: 'review' },
  ];

  const growthNav: NavItem[] = [
    { view: 'trade', label: 'Trade', icon: 'trade' },
    { view: 'analytics', label: 'Insights', icon: 'chart' },
    { view: 'plants', label: 'Plants', icon: 'plant' },
    { view: 'library', label: 'Task Library', icon: 'library' },
  ];

  const meta = PAGE_META[activeView] ?? PAGE_META.day!;
  const userLabel = session.user.email?.split('@')[0] || 'You';
  const initial = userLabel.slice(0, 1).toUpperCase();

  const handleNavClick = (view: View) => {
    setView(view);
    setMobileMore(false);
    if (isPlannerView(view)) {
      const now = new Date();
      const date = format(now, 'yyyy-MM-dd');
      setDate(date);
      useUIStore.setState({ weekStart: date, activeMonth: format(now, 'yyyy-MM') });
    }
    if (view === 'documents') dismissDocsBadge();
  };

  const mobilePrimary = primaryNav.slice(0, 4);
  const moreActive = !mobilePrimary.some((n) => n.view === activeView || (n.view === 'day' && isPlannerView(activeView)));

  const renderNavGroup = (items: NavItem[]) => items.map((item) => {
    const active = item.view === 'day' ? isPlannerView(activeView) : activeView === item.view;
    return (
      <button key={item.view} className={`df-nav-item ${active ? 'is-active' : ''}`} onClick={() => handleNavClick(item.view)} title={sidebarCollapsed ? item.label : undefined}>
        <span className="df-nav-icon"><NavIcon name={item.icon} /></span>
        {!sidebarCollapsed && <span className="df-nav-label">{item.label}</span>}
        {item.badge && !sidebarCollapsed && <span className="df-nav-badge">NEW</span>}
      </button>
    );
  });

  return (
    <div className={`df-app-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <OfflineBanner />

      <aside className="df-sidebar">
        <div className="df-brand-row">
          <button className="df-brand-mark" onClick={() => handleNavClick('home')} aria-label="DayFlow home"><span /></button>
          {!sidebarCollapsed && <div><strong>DayFlow</strong><small>Intentional living</small></div>}
          <button className="df-collapse-btn" onClick={() => setSidebarCollapsed((v) => !v)}>{sidebarCollapsed ? '›' : '‹'}</button>
        </div>

        <div className="df-sidebar-scroll">
          {!sidebarCollapsed && <p className="df-nav-section">YOUR DAY</p>}
          <nav>{renderNavGroup(primaryNav)}</nav>
          {!sidebarCollapsed && <p className="df-nav-section">GROWTH</p>}
          <nav>{renderNavGroup(growthNav)}</nav>
        </div>

        <div className="df-sidebar-footer">
          <button className={`df-nav-item ${activeView === 'settings' ? 'is-active' : ''}`} onClick={() => handleNavClick('settings')}>
            <span className="df-nav-icon"><NavIcon name="settings" /></span>
            {!sidebarCollapsed && <span className="df-nav-label">Settings</span>}
          </button>
          {!sidebarCollapsed && (
            <div className="df-profile-mini">
              <div className="df-avatar">{initial}</div>
              <div><strong>{userLabel}</strong><small>{session.user.email}</small></div>
              <button onClick={() => supabase.auth.signOut()} title="Sign out">↗</button>
            </div>
          )}
        </div>
      </aside>

      <div className="df-main-column">
        <header className="df-topbar">
          <div className="df-topbar-title">
            <span className="df-mobile-logo"><span /></span>
            <div>
              <h1>{meta.title}</h1>
              <p>{meta.subtitle}</p>
            </div>
          </div>
          <div className="df-topbar-actions">
            <div className="df-date-chip">{format(new Date(), 'EEE, MMM d')}</div>
            {needRefresh[0] && <button className="df-update-chip" onClick={() => updateServiceWorker(true)}>Update ready</button>}
            <button className="df-icon-button" onClick={toggleDark} title="Toggle appearance">{isDarkMode ? '☀' : '☾'}</button>
            <div className="df-avatar df-avatar-top">{initial}</div>
          </div>
        </header>

        <main className={`df-content ${activeView === 'documents' ? 'df-content-reading' : ''}`}>
          {activeView === 'home' && <HomePage />}
          {isPlannerView(activeView) && <PlannerPage />}
          {activeView === 'analytics' && <AnalyticsPage />}
          {activeView === 'habits' && <HabitsPage />}
          {activeView === 'fasting' && <FastingPage />}
          {activeView === 'library' && <LibraryPage />}
          {activeView === 'settings' && <SettingsPage />}
          {activeView === 'weekly_review' && <WeeklyReview />}
          {activeView === 'documents' && <DocumentsPage />}
          {activeView === 'trade' && <TradePage />}
          {activeView === 'plants' && <PlantsPage />}
        </main>
      </div>

      <nav className="df-mobile-nav">
        {mobilePrimary.map((item) => {
          const active = item.view === 'day' ? isPlannerView(activeView) : activeView === item.view;
          return (
            <button key={item.view} className={active ? 'is-active' : ''} onClick={() => handleNavClick(item.view)}>
              <NavIcon name={item.icon} /><span>{item.label}</span>
            </button>
          );
        })}
        <button className={moreActive || mobileMore ? 'is-active' : ''} onClick={() => setMobileMore((v) => !v)}>
          <span className="df-mobile-more-icon">•••</span><span>More</span>
        </button>
      </nav>

      {mobileMore && (
        <>
          <button className="df-sheet-backdrop" onClick={() => setMobileMore(false)} aria-label="Close menu" />
          <div className="df-more-sheet">
            <div className="df-sheet-handle" />
            <div className="df-sheet-head"><strong>More in DayFlow</strong><button onClick={() => setMobileMore(false)}>×</button></div>
            <div className="df-more-grid">
              {[...primaryNav.slice(4), ...growthNav, { view: 'settings', label: 'Settings', icon: 'settings' } as NavItem].map((item) => (
                <button key={item.view} onClick={() => handleNavClick(item.view)}>
                  <span><NavIcon name={item.icon}/></span><strong>{item.label}</strong>
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

  const publicUserId = useMemo(() => {
    const match = window.location.hash.match(/^#\/reading\/([^/?#]+)/);
    return match?.[1] ?? null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  if (publicUserId) return <PublicReadingLog userId={publicUserId} />;
  if (checking) return <div className="df-loading-screen"><div className="df-loading-mark"><span /></div><p>Loading your DayFlow…</p></div>;
  if (!session) return <Auth />;
  return <AuthenticatedApp session={session} />;
}
