import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1).max(255),
  nickname: z.string().max(100).optional(),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  department: z.string().min(1).max(255),
  position: z.string().min(1).max(255),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
  shiftStartTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'shiftStartTime must be HH:MM or HH:MM:SS').default('08:00:00'),
  shiftEndTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'shiftEndTime must be HH:MM or HH:MM:SS').default('17:00:00'),
  locationId: z.string().optional(),
  baseWage: z.number().positive().optional(),
  otRateUseDefault: z.boolean().default(true),
  otRateType: z.enum(['multiplier', 'fixed']).optional(),
  // No upper cap here — multiplier (e.g. 1.5×) and fixed-rate (e.g. 500 ฿/hr) use
  // very different scales. A shared cap of MAX_OT_RATE=10 falsely rejects fixed rates.
  otRateValue: z.number().positive().optional(),
  avatarUrl: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8).optional(),
});

const VALID_MENU_IDS = [
  'attendance',
  'attendance/dashboard',
  'attendance/logs',
  'attendance/employees',
  'attendance/locations',
  'attendance/ot-approvals',
  'attendance/ot-calculator',
  'attendance/reports',
  'attendance/holidays',
  'settings',
] as const;

export const updateMenusSchema = z.object({
  accessibleMenus: z.array(z.enum(VALID_MENU_IDS)),
});

export const verifyPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
});

export const setPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
  currentPin: z.string().length(4).regex(/^\d{4}$/).optional(),
});

export const listEmployeesSchema = z.object({
  department: z.string().optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});
