import { z } from 'zod';

export const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  isRecurring: z.boolean().optional().default(false),
});

export const updateHolidaySchema = createHolidaySchema.partial();
