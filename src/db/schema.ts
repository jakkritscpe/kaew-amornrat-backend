import {
  pgTable,
  text,
  varchar,
  numeric,
  boolean,
  real,
  timestamp,
  date,
  time,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['admin', 'manager', 'employee']);
export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'late',
  'absent',
  'on_leave',
]);
export const otStatusEnum = pgEnum('ot_status', ['pending', 'approved', 'rejected']);
export const otRateTypeEnum = pgEnum('ot_rate_type', ['multiplier', 'fixed']);

// Work Locations
export const workLocations = pgTable('work_locations', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  radiusMeters: real('radius_meters').notNull().default(200),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Employees
export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  department: varchar('department', { length: 255 }).notNull(),
  position: varchar('position', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('employee'),
  shiftStartTime: time('shift_start_time').notNull().default('08:00:00'),
  shiftEndTime: time('shift_end_time').notNull().default('17:00:00'),
  locationId: text('location_id').references(() => workLocations.id),
  baseWage: numeric('base_wage', { precision: 10, scale: 2 }),
  otRateUseDefault: boolean('ot_rate_use_default').notNull().default(true),
  otRateType: otRateTypeEnum('ot_rate_type'),
  otRateValue: real('ot_rate_value'),
  avatarUrl: text('avatar_url'),
  qrToken: text('qr_token').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Attendance Logs
export const attendanceLogs = pgTable('attendance_logs', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  date: date('date').notNull(),
  checkInTime: timestamp('check_in_time'),
  checkOutTime: timestamp('check_out_time'),
  checkInLat: real('check_in_lat'),
  checkInLng: real('check_in_lng'),
  checkOutLat: real('check_out_lat'),
  checkOutLng: real('check_out_lng'),
  workHours: real('work_hours').notNull().default(0),
  otHours: real('ot_hours').notNull().default(0),
  status: attendanceStatusEnum('status').notNull().default('absent'),
  locationId: text('location_id').references(() => workLocations.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// OT Requests
export const otRequests = pgTable('ot_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  reason: text('reason').notNull(),
  status: otStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Company Settings (single row)
export const companySettings = pgTable('company_settings', {
  id: text('id').primaryKey().default('default'),
  defaultOtRateType: otRateTypeEnum('default_ot_rate_type').notNull().default('multiplier'),
  defaultOtRateValue: real('default_ot_rate_value').notNull().default(1.5),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
