import { z } from 'zod';
import { timeToMinutes } from '../../shared/utils/time';

const timeRegex = /^\d{2}:\d{2}$/;

/** Max OT session: 12 hours */
const MAX_OT_MINUTES = 12 * 60;

export const submitOTSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  startTime: z.string().regex(timeRegex, 'startTime must be HH:MM'),
  endTime: z.string().regex(timeRegex, 'endTime must be HH:MM'),
  reason: z.string().min(1).max(1000),
}).refine((d) => {
  // Allow night-shift OT where endTime < startTime (crosses midnight, e.g. 22:00 → 02:00)
  let minutes = timeToMinutes(d.endTime) - timeToMinutes(d.startTime);
  if (minutes <= 0) minutes += 24 * 60; // crosses midnight
  return minutes > 0 && minutes <= MAX_OT_MINUTES;
}, {
  message: `OT ต้องไม่เกิน ${MAX_OT_MINUTES / 60} ชั่วโมง และ startTime ต้องไม่เท่ากับ endTime`,
  path: ['endTime'],
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
