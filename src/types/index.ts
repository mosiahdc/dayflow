export type Category = 'work' | 'personal' | 'health' | 'learning';

export type RecurringPattern =
    | { type: 'none' }
    | { type: 'daily' }
    | { type: 'weekly'; days: DayOfWeek[] }
    | { type: 'weekdays' };

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type TimerMode = 'countdown' | 'pomodoro';
export type TimerState = 'idle' | 'running' | 'paused' | 'done';

// ── Task prototype — lives in the library ─────────────────────────────────────
export interface Task {
    id: string;
    userId: string;
    title: string;
    color: string;
    category: Category;
    durationMins: number;
    notes?: string;
    recurring: RecurringPattern;
    createdAt: string;
}

// ── Scheduled instance — placed on a day ──────────────────────────────────────
export interface ScheduledTask {
    id: string;
    taskId: string;
    task: Task;
    userId: string;
    date: string;
    startSlot: number;
    done: boolean;
    timerStartedAt?: string;
    createdAt: string;
}

// ── Time slot — generated client-side ─────────────────────────────────────────
export interface TimeSlot {
    index: number;
    label: string;
    hour: number;
    minute: number;
}

// ── Habit prototype ───────────────────────────────────────────────────────────
export interface Habit {
    id: string;
    userId: string;
    title: string;
    category: Category;
    color: string;
    targetDays: DayOfWeek[];
    createdAt: string;
}

// ── Daily habit completion ────────────────────────────────────────────────────
export interface HabitEntry {
    id: string;
    habitId: string;
    userId: string;
    date: string;
    completed: boolean;
    completedAt?: string;
}

// ── Day template ──────────────────────────────────────────────────────────────
export interface DayTemplate {
    id: string;
    userId: string;
    name: string;
    scheduledTasks: Omit<ScheduledTask, 'id' | 'date' | 'userId'>[];
    createdAt: string;
}

// ── Reflection ────────────────────────────────────────────────────────────────
export interface Reflection {
    id: string;
    userId: string;
    date: string;
    accomplished: string;
    carryOver: string;
    createdAt: string;
}

// ── Priority item ─────────────────────────────────────────────────────────────
export type PriorityLevel = 'high' | 'medium' | 'low';

export interface PriorityItem {
    id: string;
    userId: string;
    title: string;
    priority: PriorityLevel;
    done: boolean;
    dueDate?: string;
    createdAt: string;
}

// ── Audit log ─────────────────────────────────────────────────────────────────
export interface AuditEntry {
    id: string;
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

// ── Category color map ────────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<Category, string> = {
    work: '#4F6EF7',
    personal: '#7C3AED',
    health: '#10B981',
    learning: '#F59E0B',
};