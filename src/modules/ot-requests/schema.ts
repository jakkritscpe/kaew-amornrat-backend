import { z } from 'zod';

export const submitOTSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string().min(1),
});

export const updateOTStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const listOTSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  employeeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
