import { z } from 'zod';

export const TaskSchema = z.object({
    title: z.string().min(1).max(120).trim(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    category: z.enum(['work', 'personal', 'health', 'learning']),
    durationMins: z.number().int().min(30).max(480).multipleOf(30),
    notes: z.string().max(500).optional(),
});

export const HabitSchema = z.object({
    title: z.string().min(1).max(120).trim(),
    category: z.enum(['work', 'personal', 'health', 'learning']),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    targetDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
});