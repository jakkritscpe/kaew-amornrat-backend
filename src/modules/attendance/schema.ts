import { z } from 'zod';

export const checkInSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const checkOutSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const listLogsSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave']).optional(),
});

export const updateLogSchema = z.object({
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave']).optional(),
  workHours: z.number().optional(),
  otHours: z.number().optional(),
});
