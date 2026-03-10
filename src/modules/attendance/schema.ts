import { z } from 'zod';

export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const checkOutSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const listLogsSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateLogSchema = z.object({
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave']).optional(),
  workHours: z.number().optional(),
  otHours: z.number().optional(),
});
