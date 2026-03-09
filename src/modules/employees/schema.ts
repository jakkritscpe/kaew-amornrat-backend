import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  department: z.string().min(1),
  position: z.string().min(1),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
  shiftStartTime: z.string().default('08:00:00'),
  shiftEndTime: z.string().default('17:00:00'),
  locationId: z.string().optional(),
  baseWage: z.number().positive().optional(),
  otRateUseDefault: z.boolean().default(true),
  otRateType: z.enum(['multiplier', 'fixed']).optional(),
  otRateValue: z.number().positive().optional(),
  avatarUrl: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
});

export const listEmployeesSchema = z.object({
  department: z.string().optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  search: z.string().optional(),
});
