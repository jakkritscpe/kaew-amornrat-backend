import { z } from 'zod';
import { LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX } from '../../shared/config';

const coordSchema = z.object({
  lat: z.number().min(LAT_MIN).max(LAT_MAX),
  lng: z.number().min(LNG_MIN).max(LNG_MAX),
});

export const checkInSchema = coordSchema;
export const checkOutSchema = coordSchema;

export const listLogsSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export const updateLogSchema = z.object({
  checkInTime: z.string().datetime({ offset: true }).optional(),
  checkOutTime: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave']).optional(),
  workHours: z.number().min(0).optional(),
  otHours: z.number().min(0).optional(),
});
