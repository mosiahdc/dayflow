import { useNotificationStore } from '@/store/notificationStore';

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
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0
        ${enabled ? 'bg-brand-accent' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
          ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
        <h2 className="text-sm font-semibold dark:text-white">{title}</h2>
      </div>
      <div className="divide-y dark:divide-gray-700">{children}</div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium dark:text-white">{label}</p>
        {description && <p className="text-xs text-brand-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  isBiometricAvailable,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from '@/lib/biometric';

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

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold dark:text-white mb-4">⚙️ Settings</h1>

      {/* Task Reminders */}
      <Section title="🔔 Task Reminders">
        <Row
          label="Enable task reminders"
          description="Get notified before a scheduled task starts"
        >
          <Toggle
            enabled={taskRemindersEnabled}
            onChange={(v) => update({ taskRemindersEnabled: v })}
          />
        </Row>

        {taskRemindersEnabled && (
          <Row label="Remind me" description="How early to send the reminder">
            <select
              value={reminderMinutes}
              onChange={(e) =>
                update({ reminderMinutes: Number(e.target.value) as 5 | 10 | 15 | 30 })
              }
              className="text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:text-white dark:border-gray-600 bg-white"
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

      {/* Daily Planning Reminder */}
      <Section title="📅 Daily Planning Reminder">
        <Row label="Enable daily reminder" description="Get a notification to plan your day">
          <Toggle
            enabled={dailyPlanningEnabled}
            onChange={(v) => update({ dailyPlanningEnabled: v })}
          />
        </Row>

        {dailyPlanningEnabled && (
          <Row label="Reminder time" description="What time to send the planning reminder">
            <input
              type="time"
              value={dailyPlanningTime}
              onChange={(e) => update({ dailyPlanningTime: e.target.value })}
              className="text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:text-white dark:border-gray-600 bg-white"
            />
          </Row>
        )}
      </Section>

      {/* Morning Reminder */}
      <Section title="🌅 Morning Reminder">
        <Row
          label="Enable morning reminder"
          description="Get notified to check your planned tasks for the day"
        >
          <Toggle
            enabled={morningReminderEnabled}
            onChange={(v) => update({ morningReminderEnabled: v })}
          />
        </Row>

        {morningReminderEnabled && (
          <Row label="Reminder time" description="What time to send the morning reminder">
            <input
              type="time"
              value={morningReminderTime}
              onChange={(e) => update({ morningReminderTime: e.target.value })}
              className="text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:text-white dark:border-gray-600 bg-white"
            />
          </Row>
        )}
      </Section>

      {/* Habit Reminders */}
      <Section title="✅ Habit Reminders">
        <Row label="Enable habit reminders" description="Daily reminder to check off your habits">
          <Toggle
            enabled={habitRemindersEnabled}
            onChange={(v) => update({ habitRemindersEnabled: v })}
          />
        </Row>

        {habitRemindersEnabled && (
          <Row label="Reminder time" description="What time to send the habit reminder">
            <input
              type="time"
              value={habitReminderTime}
              onChange={(e) => update({ habitReminderTime: e.target.value })}
              className="text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:text-white dark:border-gray-600 bg-white"
            />
          </Row>
        )}
      </Section>

      <p className="text-xs text-brand-muted text-center mt-2">
        Settings are saved automatically on this device.
      </p>
    </div>
  );
}
