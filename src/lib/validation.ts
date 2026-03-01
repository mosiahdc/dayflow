import { z } from 'zod';

export const TaskSchema = z.object({
    title: z.string().min(1).max(120).trim(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    category: z.string().min(1).max(50),
    durationMins: z.number().int().min(30).max(1440),
    notes: z.string().max(500).optional(),
});

export const HabitSchema = z.object({
    title: z.string().min(1).max(120).trim(),
    category: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    targetDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
});

export const PriorityItemSchema = z.object({
    title: z.string().min(1).max(120).trim(),
    priority: z.enum(['high', 'medium', 'low']),
    dueDate: z.string().optional(),
});