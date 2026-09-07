import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import CalendarSync from '@/components/CalendarSync';
import { Capacitor } from '@capacitor/core';
import {
  isBiometricAvailable,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from '@/lib/biometric';

const REMINDER_OPTIONS: { value: 5 | 10 | 15 | 30; label: string }[] = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`df-toggle ${enabled ? 'is-on' : ''}`}
      aria-pressed={enabled}
      aria-label={enabled ? 'Disable setting' : 'Enable setting'}
    />
  );
}

function Section({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="df-settings-section">
      <div className="df-settings-section-head">
        <div>
          <div className="df-kicker">SETTINGS</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {badge && <span className="df-chip is-blue">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  description,
  children,
  below,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  below?: React.ReactNode;
}) {
  return (
    <div>
      <div className="df-settings-row">
        <div>
          <h3>{label}</h3>
          {description && <p>{description}</p>}
          {below}
        </div>
        <div className="df-settings-actions">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    taskRemindersEnabled,
    reminderMinutes,
    dailyPlanningEnabled,
    dailyPlanningTime,
    habitRemindersEnabled,
    habitReminderTime,
    morningReminderEnabled,
    morningReminderTime,
    update,
  } = useNotificationStore();

  const { initialBalance, setInitialBalance, fetchSettings } = useTradeSettingsStore();

  const [balanceInput, setBalanceInput] = useState('');
  const [balanceSaved, setBalanceSaved] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setBalanceInput(String(initialBalance || ''));
  }, [initialBalance]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supported = Capacitor.isNativePlatform() ? await isBiometricAvailable() : false;
        const enabled = supported ? await isBiometricLockEnabled() : false;
        if (!mounted) return;
        setBiometricSupported(Boolean(supported));
        setBiometricEnabled(Boolean(enabled));
      } catch {
        if (!mounted) return;
        setBiometricSupported(false);
        setBiometricEnabled(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveBalance = async () => {
    const val = parseFloat(balanceInput);
    if (Number.isNaN(val) || val < 0) return;
    setBalanceError('');
    try {
      await setInitialBalance(val);
      setBalanceSaved(true);
      setTimeout(() => setBalanceSaved(false), 2000);
    } catch (error) {
      setBalanceSaved(false);
      setBalanceError(error instanceof Error ? error.message : 'Could not save Initial Balance.');
    }
  };

  const handleToggleBiometric = async (next: boolean) => {
    try {
      await setBiometricLockEnabled(next);
      setBiometricEnabled(next);
    } catch {
      setBiometricEnabled(false);
    }
  };

  return (
    <div className="df-page df-settings-page">
      <div className="df-settings-hero">
        <section className="df-settings-intro">
          <span className="df-kicker">CONTROL CENTER</span>
          <h2>Tune the app once, then let the system support your routine.</h2>
          <p>
            Manage reminders, trading defaults, calendar syncing, and security in one place.
            All settings save on this device automatically unless a feature says otherwise.
          </p>
        </section>

        <section className="df-settings-mini-card">
          <span className="df-kicker">AT A GLANCE</span>
          <h3>Current setup</h3>
          <div className="df-inline-actions" style={{ marginTop: 10 }}>
            <span className={`df-chip ${taskRemindersEnabled ? 'is-green' : ''}`}>Task reminders {taskRemindersEnabled ? 'on' : 'off'}</span>
            <span className={`df-chip ${dailyPlanningEnabled ? 'is-blue' : ''}`}>Planning {dailyPlanningEnabled ? dailyPlanningTime : 'off'}</span>
            <span className={`df-chip ${habitRemindersEnabled ? 'is-amber' : ''}`}>Habits {habitRemindersEnabled ? habitReminderTime : 'off'}</span>
            <span className={`df-chip ${morningReminderEnabled ? 'is-purple' : ''}`}>Morning {morningReminderEnabled ? morningReminderTime : 'off'}</span>
            {biometricSupported && <span className={`df-chip ${biometricEnabled ? 'is-green' : ''}`}>Biometric {biometricEnabled ? 'enabled' : 'disabled'}</span>}
          </div>
        </section>
      </div>

      <Section title="Trading" subtitle="Account starting values and trading-related preferences." badge="Project Discipline">
        <Row
          label="Initial Balance"
          description="Your starting account balance for Project Discipline. Exness deposits and withdrawals are added on top automatically."
          below={balanceError ? <p style={{ color: 'var(--df-red)', marginTop: 8 }}>{balanceError}</p> : undefined}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            value={balanceInput}
            onChange={(e) => {
              setBalanceInput(e.target.value);
              setBalanceSaved(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && void handleSaveBalance()}
            placeholder="0.00"
            className="df-settings-input"
          />
          <button
            onClick={() => void handleSaveBalance()}
            className="df-btn df-btn-primary"
            style={{ minWidth: 96 }}
          >
            {balanceSaved ? 'Saved ✓' : 'Save'}
          </button>
        </Row>
      </Section>

      <Section title="Task Reminders" subtitle="Control alerts before scheduled tasks start." badge={taskRemindersEnabled ? 'Enabled' : 'Disabled'}>
        <Row label="Enable task reminders" description="Get notified before a scheduled task starts.">
          <Toggle enabled={taskRemindersEnabled} onChange={(v) => update({ taskRemindersEnabled: v })} />
        </Row>
        {taskRemindersEnabled && (
          <Row label="Reminder lead time" description="How early to send the reminder.">
            <select
              value={reminderMinutes}
              onChange={(e) => update({ reminderMinutes: Number(e.target.value) as 5 | 10 | 15 | 30 })}
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
        )}
      </Section>

      <Section title="Planning Routine" subtitle="Keep your day opening and review routine consistent.">
        <Row label="Daily planning reminder" description="Get a reminder to plan the day ahead.">
          <Toggle enabled={dailyPlanningEnabled} onChange={(v) => update({ dailyPlanningEnabled: v })} />
        </Row>
        {dailyPlanningEnabled && (
          <Row label="Planning reminder time" description="When to prompt you to plan.">
            <input type="time" value={dailyPlanningTime} onChange={(e) => update({ dailyPlanningTime: e.target.value })} />
          </Row>
        )}

        <Row label="Morning reminder" description="A quick reminder to check your planned tasks for the day.">
          <Toggle enabled={morningReminderEnabled} onChange={(v) => update({ morningReminderEnabled: v })} />
        </Row>
        {morningReminderEnabled && (
          <Row label="Morning reminder time" description="Choose the best time to receive it.">
            <input type="time" value={morningReminderTime} onChange={(e) => update({ morningReminderTime: e.target.value })} />
          </Row>
        )}
      </Section>

      <Section title="Habits" subtitle="Keep daily habit nudges lightweight but consistent." badge={habitRemindersEnabled ? 'Reminder active' : 'Reminder off'}>
        <Row label="Enable habit reminders" description="Daily reminder to check off your habits.">
          <Toggle enabled={habitRemindersEnabled} onChange={(v) => update({ habitRemindersEnabled: v })} />
        </Row>
        {habitRemindersEnabled && (
          <Row label="Habit reminder time" description="When you want the reminder to appear.">
            <input type="time" value={habitReminderTime} onChange={(e) => update({ habitReminderTime: e.target.value })} />
          </Row>
        )}
      </Section>

      {biometricSupported && (
        <Section title="Security" subtitle="Protect access to DayFlow on supported native devices.">
          <Row label="Biometric lock" description="Require biometrics when reopening the app.">
            <Toggle enabled={biometricEnabled} onChange={(v) => void handleToggleBiometric(v)} />
          </Row>
        </Section>
      )}

      <CalendarSync />

      <p className="df-settings-footer">Settings are saved automatically on this device.</p>
    </div>
  );
}
