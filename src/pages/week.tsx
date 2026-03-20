import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store/uiStore';
import { useHabitStore } from '@/store/habitStore';

const STORAGE_KEY = 'dayflow-settings';

interface Settings {
  taskRemindersEnabled: boolean;
  taskReminderMinutes: number;
  dailyPlanningEnabled: boolean;
  dailyPlanningTime: string;
  morningReminderEnabled: boolean;
  morningReminderTime: string;
  habitRemindersEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  taskRemindersEnabled: true,
  taskReminderMinutes: 5,
  dailyPlanningEnabled: false,
  dailyPlanningTime: '08:00',
  morningReminderEnabled: false,
  morningReminderTime: '07:00',
  habitRemindersEnabled: false,
};

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ── Toggle switch ──────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
        value ? 'bg-brand-accent' : 'bg-gray-400 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Section card ───────────────────────────────────────────────────────────
function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl p-4 flex flex-col gap-4">
      {children}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold dark:text-white">{label}</p>
        {description && <p className="text-xs text-brand-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg">{icon}</span>
      <h2 className="text-sm font-bold dark:text-white">{title}</h2>
    </div>
  );
}

// ── Notification permission banner ─────────────────────────────────────────
function NotifBanner() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setSupported(true);
    setPermission(Notification.permission);
    const iv = setInterval(() => setPermission(Notification.permission), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!supported || permission === 'granted') return null;

  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
        <span className="text-xl shrink-0">🔕</span>
        <div>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Notifications blocked
          </p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
            Enable notifications in your browser or phone settings to receive reminders.
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => Notification.requestPermission().then(setPermission)}
      className="flex items-center gap-3 w-full bg-brand-accent/10 border border-brand-accent/30 rounded-xl p-3 mb-4 hover:bg-brand-accent/20 transition-colors"
    >
      <span className="text-xl shrink-0">🔔</span>
      <div className="text-left">
        <p className="text-sm font-semibold text-brand-accent">Enable Notifications</p>
        <p className="text-xs text-brand-muted mt-0.5">
          Tap to allow reminders for tasks and habits
        </p>
      </div>
      <span className="ml-auto text-brand-accent text-sm shrink-0">→</span>
    </button>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const { isDarkMode, toggleDark } = useUIStore();
  const { habits, updateHabit, fetchHabits } = useHabitStore();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [userEmail, setUserEmail] = useState('');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [reminderInput, setReminderInput] = useState('');

  useEffect(() => {
    fetchHabits();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });
  }, [fetchHabits]);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }

  function fmt12(time24: string): string {
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr ?? '0', 10);
    const m = mStr ?? '00';
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${period}`;
  }

  return (
    <div className="max-w-xl mx-auto px-1">
      <h1 className="text-xl font-bold dark:text-white mb-5 flex items-center gap-2">
        <span>⚙️</span> Settings
      </h1>

      {/* Notification permission banner */}
      <NotifBanner />

      <div className="flex flex-col gap-4">
        {/* ── Task Reminders ── */}
        <SettingCard>
          <SectionHeader icon="🔔" title="Task Reminders" />
          <SettingRow
            label="Enable task reminders"
            description="Get notified before a scheduled task starts"
          >
            <Toggle
              value={settings.taskRemindersEnabled}
              onChange={(v) => update({ taskRemindersEnabled: v })}
            />
          </SettingRow>
          {settings.taskRemindersEnabled && (
            <SettingRow label="Remind me" description="How early to send the reminder">
              <select
                value={settings.taskReminderMinutes}
                onChange={(e) => update({ taskReminderMinutes: Number(e.target.value) })}
                className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 shrink-0"
              >
                {[1, 2, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} minute{m > 1 ? 's' : ''} before
                  </option>
                ))}
              </select>
            </SettingRow>
          )}
        </SettingCard>

        {/* ── Daily Planning Reminder ── */}
        <SettingCard>
          <SectionHeader icon="📅" title="Daily Planning Reminder" />
          <SettingRow
            label="Enable daily reminder"
            description="Get a notification to plan your day"
          >
            <Toggle
              value={settings.dailyPlanningEnabled}
              onChange={(v) => update({ dailyPlanningEnabled: v })}
            />
          </SettingRow>
          {settings.dailyPlanningEnabled && (
            <SettingRow label="Reminder time" description="When to remind you to plan">
              <input
                type="time"
                value={settings.dailyPlanningTime}
                onChange={(e) => update({ dailyPlanningTime: e.target.value })}
                className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 shrink-0"
              />
            </SettingRow>
          )}
        </SettingCard>

        {/* ── Morning Reminder ── */}
        <SettingCard>
          <SectionHeader icon="🌅" title="Morning Reminder" />
          <SettingRow
            label="Enable morning reminder"
            description="Get notified to check your planned tasks for the day"
          >
            <Toggle
              value={settings.morningReminderEnabled}
              onChange={(v) => update({ morningReminderEnabled: v })}
            />
          </SettingRow>
          {settings.morningReminderEnabled && (
            <SettingRow label="Wake-up time" description="When to send the morning check-in">
              <input
                type="time"
                value={settings.morningReminderTime}
                onChange={(e) => update({ morningReminderTime: e.target.value })}
                className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 shrink-0"
              />
            </SettingRow>
          )}
        </SettingCard>

        {/* ── Habit Reminders ── */}
        <SettingCard>
          <SectionHeader icon="✅" title="Habit Reminders" />
          <SettingRow
            label="Enable habit reminders"
            description="Receive reminders for individual habits"
          >
            <Toggle
              value={settings.habitRemindersEnabled}
              onChange={(v) => update({ habitRemindersEnabled: v })}
            />
          </SettingRow>

          {settings.habitRemindersEnabled && habits.length > 0 && (
            <div className="flex flex-col gap-2 border-t dark:border-gray-700 pt-3">
              <p className="text-xs text-brand-muted font-medium">Per-habit reminder times</p>
              {habits.map((habit) => (
                <div key={habit.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: habit.color }}
                      />
                      <p className="text-sm dark:text-white truncate">{habit.title}</p>
                    </div>
                    {editingHabitId !== habit.id && (
                      <button
                        onClick={() => {
                          setEditingHabitId(habit.id);
                          setReminderInput(habit.reminderTime ?? '');
                        }}
                        className="text-xs px-2 py-1 rounded-lg border shrink-0 transition-colors"
                        style={{
                          borderColor: habit.color,
                          color: habit.color,
                          backgroundColor: `${habit.color}15`,
                        }}
                      >
                        {habit.reminderTime ? `🔔 ${fmt12(habit.reminderTime)}` : '+ Set time'}
                      </button>
                    )}
                  </div>

                  {editingHabitId === habit.id && (
                    <div className="flex flex-col gap-2 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-3">
                      <p className="text-[10px] text-brand-muted">
                        Fires on: {habit.targetDays.join(', ')}
                      </p>
                      <input
                        type="time"
                        value={reminderInput}
                        autoFocus
                        onChange={(e) => setReminderInput(e.target.value)}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      />
                      <div className="flex gap-2">
                        {habit.reminderTime && (
                          <button
                            onClick={async () => {
                              await updateHabit(habit.id, { reminderTime: undefined });
                              setEditingHabitId(null);
                            }}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-200 dark:border-red-800"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => setEditingHabitId(null)}
                          className="flex-1 py-1.5 rounded-lg text-xs border dark:text-white dark:border-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            await updateHabit(habit.id, {
                              reminderTime: reminderInput || undefined,
                            });
                            setEditingHabitId(null);
                          }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: habit.color }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {settings.habitRemindersEnabled && habits.length === 0 && (
            <p className="text-xs text-brand-muted">No habits yet — add some in the Habits tab.</p>
          )}
        </SettingCard>

        {/* ── Appearance ── */}
        <SettingCard>
          <SectionHeader icon="🎨" title="Appearance" />
          <SettingRow
            label="Dark Mode"
            description={isDarkMode ? 'Currently using dark theme' : 'Currently using light theme'}
          >
            <Toggle value={isDarkMode} onChange={() => toggleDark()} />
          </SettingRow>
        </SettingCard>

        {/* ── Account ── */}
        <SettingCard>
          <SectionHeader icon="👤" title="Account" />
          {userEmail && (
            <SettingRow label="Signed in as" description={userEmail}>
              <span />
            </SettingRow>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </SettingCard>

        {/* ── About ── */}
        <SettingCard>
          <SectionHeader icon="ℹ️" title="About" />
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'App', value: 'DayFlow' },
              { label: 'Version', value: '1.0.0' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-brand-muted">{label}</span>
                <span className="text-sm font-medium dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </SettingCard>
      </div>

      <p className="text-xs text-brand-muted text-center mt-6 mb-4">
        Settings are saved automatically on this device.
      </p>
    </div>
  );
}
