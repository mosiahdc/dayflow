/**
 * CalendarSync — Google Calendar integration settings panel.
 * Renders inside SettingsPage.
 *
 * Flow:
 * 1. User clicks "Connect Google Calendar"
 * 2. We call the Edge Function ?action=auth_url → get OAuth URL → open popup
 * 3. Google redirects to REDIRECT_URI (your Edge Function ?action=exchange)
 * 4. Edge Function exchanges code, stores tokens, closes popup
 * 5. Popup posts message 'gcal-connected' to opener → we update UI
 * 6. User can then "Sync this week" to push tasks to Google Calendar
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePlannerStore } from '@/store/plannerStore';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';

// ── Config ────────────────────────────────────────────────────────────────────
// Set this to your deployed Supabase Edge Function URL
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;

async function getToken(): Promise<string> {
  // 1. Try getSession (fastest path)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  // 2. Try refreshSession (forces re-read from storage)
  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.session?.access_token) return refreshed.session.access_token;

  // 3. Last resort: read directly from localStorage
  // Supabase stores the session under a key like "sb-<ref>-auth-token"
  const lsKey = Object.keys(localStorage).find(
    (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
  );
  if (lsKey) {
    try {
      const raw = JSON.parse(localStorage.getItem(lsKey) ?? '{}');
      const token = raw?.access_token ?? raw?.session?.access_token;
      if (token) return token;
    } catch {
      /* ignore */
    }
  }

  throw new Error('No auth session found — please reload the page.');
}

async function callEdgeFn(action: string, body?: unknown) {
  const token = await getToken();
  const res = await fetch(`${EDGE_FN_URL}?action=${action}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok && res.status === 401) throw new Error('Auth failed');
  return res.json();
}

function btn(color = 'var(--df-accent)'): React.CSSProperties {
  return {
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  };
}

const s: Record<string, React.CSSProperties> = {
  section: {
    background: 'var(--df-surface)',
    border: '1px solid var(--df-border)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    padding: '10px 16px',
    background: 'var(--df-surface2)',
    borderBottom: '1px solid var(--df-border)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--df-text)',
  },
  body: { padding: '14px 16px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap' as const,
    marginBottom: 10,
  },
  label: { fontSize: 13, color: 'var(--df-text)', fontWeight: 500 },
  desc: { fontSize: 11, color: 'var(--df-muted)', marginTop: 2 },

  btnOutline: {
    background: 'transparent',
    color: 'var(--df-muted)',
    border: '1px solid var(--df-border)',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,
  connectedDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--df-green)',
    marginRight: 6,
  },
  syncResult: {
    marginTop: 10,
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--df-surface2)',
    border: '1px solid var(--df-border)',
    color: 'var(--df-muted)',
  },
};

export default function CalendarSync() {
  const [connected, setConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const { scheduledTasks, fetchByWeek } = usePlannerStore();

  // ── Load status ─────────────────────────────────────────────────────────
  useEffect(() => {
    callEdgeFn('status')
      .then((data) => {
        setConnected(data.connected ?? false);
        setLastSynced(data.lastSynced ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Listen for popup callback ────────────────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data === 'gcal-connected') {
        setConnected(true);
        setSyncResult('✓ Google Calendar connected!');
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────
  async function handleConnect() {
    try {
      const data = await callEdgeFn('auth_url');
      if (!data.url) {
        setSyncResult(
          '❌ Could not get auth URL. Check secrets are set in Supabase Dashboard → Settings → Edge Functions.'
        );
        return;
      }
      window.open(data.url, 'gcal-auth', 'width=500,height=650,scrollbars=yes');
    } catch (e) {
      setSyncResult('❌ Auth error — try refreshing the page and connecting again.');
      console.error('CalendarSync handleConnect:', e);
    }
  }

  // ── Sync this week ───────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);

    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    await fetchByWeek(weekStart, weekEnd);

    const tasks = scheduledTasks
      .filter((t) => t.date >= weekStart && t.date <= weekEnd)
      .map((t) => ({
        id: t.id,
        title: t.task.title,
        notes: t.task.notes,
        date: t.date,
        startSlot: t.startSlot,
        durationMins: t.task.durationMins,
        category: t.task.category,
      }));

    if (tasks.length === 0) {
      setSyncResult('No tasks scheduled this week to sync.');
      setSyncing(false);
      return;
    }

    try {
      const result = await callEdgeFn('push', { tasks });
      const succeeded = result.results?.filter((r: { error?: string }) => !r.error).length ?? 0;
      const failed = result.results?.filter((r: { error?: string }) => r.error).length ?? 0;
      setLastSynced(new Date().toISOString());
      setSyncResult(
        failed === 0
          ? `✓ Synced ${succeeded} task${succeeded !== 1 ? 's' : ''} to Google Calendar`
          : `Synced ${succeeded}, failed ${failed}. Check console for details.`
      );
    } catch {
      setSyncResult('❌ Sync failed. Check your connection and try again.');
    }
    setSyncing(false);
  }

  // ── Sync next 7 days ─────────────────────────────────────────────────────
  async function handleSyncNext7() {
    setSyncing(true);
    setSyncResult(null);
    const today = new Date();
    const start = format(today, 'yyyy-MM-dd');
    const end = format(addDays(today, 6), 'yyyy-MM-dd');
    await fetchByWeek(start, end);

    const tasks = scheduledTasks
      .filter((t) => t.date >= start && t.date <= end)
      .map((t) => ({
        id: t.id,
        title: t.task.title,
        notes: t.task.notes,
        date: t.date,
        startSlot: t.startSlot,
        durationMins: t.task.durationMins,
        category: t.task.category,
      }));

    if (tasks.length === 0) {
      setSyncResult('No tasks in the next 7 days to sync.');
      setSyncing(false);
      return;
    }

    try {
      const result = await callEdgeFn('push', { tasks });
      const succeeded = result.results?.filter((r: { error?: string }) => !r.error).length ?? 0;
      setLastSynced(new Date().toISOString());
      setSyncResult(`✓ Synced ${succeeded} task${succeeded !== 1 ? 's' : ''} (next 7 days)`);
    } catch {
      setSyncResult('❌ Sync failed.');
    }
    setSyncing(false);
  }

  // ── Revoke ───────────────────────────────────────────────────────────────
  async function handleRevoke() {
    if (!confirm('Disconnect Google Calendar? Your synced events will remain in Google Calendar.'))
      return;
    setRevoking(true);
    await callEdgeFn('revoke');
    setConnected(false);
    setLastSynced(null);
    setSyncResult('Disconnected.');
    setRevoking(false);
  }

  if (loading) return null;

  return (
    <div style={s.section}>
      <div style={s.header}>📅 Google Calendar Sync</div>
      <div style={s.body}>
        {!connected ? (
          <>
            <div style={s.row}>
              <div>
                <div style={s.label}>Connect Google Calendar</div>
                <div style={s.desc}>Push your DayFlow tasks to Google Calendar automatically</div>
              </div>
              <button style={btn()} onClick={handleConnect}>
                Connect
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--df-muted)', lineHeight: 1.6 }}>
              Requires a Google account. Only events you sync will be created — DayFlow never reads
              or deletes your existing calendar events.
            </div>
          </>
        ) : (
          <>
            <div style={s.row}>
              <div>
                <div style={s.label}>
                  <span style={s.connectedDot} />
                  Connected to Google Calendar
                </div>
                {lastSynced && (
                  <div style={s.desc}>Last synced {new Date(lastSynced).toLocaleString()}</div>
                )}
              </div>
              <button style={s.btnOutline} onClick={handleRevoke} disabled={revoking}>
                {revoking ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button style={btn()} onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing…' : '⟳ Sync this week'}
              </button>
              <button style={btn('var(--df-purple)')} onClick={handleSyncNext7} disabled={syncing}>
                Sync next 7 days
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--df-muted)', marginTop: 8, lineHeight: 1.6 }}>
              Sync pushes your scheduled tasks to Google Calendar as events. It does not pull from
              or delete events in Google Calendar.
            </div>
          </>
        )}

        {syncResult && <div style={s.syncResult}>{syncResult}</div>}
      </div>
    </div>
  );
}
