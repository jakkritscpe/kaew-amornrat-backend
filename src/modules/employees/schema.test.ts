import { describe, expect, test } from 'bun:test';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema } from './schema';

describe('createEmployeeSchema', () => {
  const validEmployee = {
    name: 'สมชาย ใจดี',
    email: 'somchai@test.com',
    password: 'password123',
    department: 'IT',
    position: 'Developer',
  };

  test('valid with required fields only', () => {
    const result = createEmployeeSchema.safeParse(validEmployee);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('employee'); // default
      expect(result.data.shiftStartTime).toBe('08:00:00');
      expect(result.data.shiftEndTime).toBe('17:00:00');
      expect(result.data.otRateUseDefault).toBe(true);
    }
  });

  test('valid with all fields', () => {
    const result = createEmployeeSchema.safeParse({
      ...validEmployee,
      nickname: 'ชาย',
      role: 'admin',
      shiftStartTime: '09:00:00',
      shiftEndTime: '18:00:00',
      locationId: 'loc_001',
      baseWage: 15000,
      otRateUseDefault: false,
      otRateType: 'multiplier',
      otRateValue: 1.5,
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    expect(result.success).toBe(true);
  });

  test('missing required name', () => {
    const { name: _, ...noName } = validEmployee;
    expect(createEmployeeSchema.safeParse(noName).success).toBe(false);
  });

  test('invalid email', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: 'not-email' }).success).toBe(false);
  });

  test('password too short', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, password: '12345' }).success).toBe(false);
  });

  test('invalid role', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, role: 'superadmin' }).success).toBe(false);
  });

  test('valid roles', () => {
    for (const role of ['admin', 'manager', 'employee']) {
      expect(createEmployeeSchema.safeParse({ ...validEmployee, role }).success).toBe(true);
    }
  });

  test('negative baseWage rejected', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, baseWage: -100 }).success).toBe(false);
  });
});

describe('updateEmployeeSchema', () => {
  test('empty object valid (all optional)', () => {
    expect(updateEmployeeSchema.safeParse({}).success).toBe(true);
  });

  test('partial update name only', () => {
    expect(updateEmployeeSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  test('password optional but min 6', () => {
    expect(updateEmployeeSchema.safeParse({ password: '12345' }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ password: '123456' }).success).toBe(true);
  });
});

describe('listEmployeesSchema', () => {
  test('empty uses defaults', () => {
    const result = listEmployeesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  test('valid filters', () => {
    const result = listEmployeesSchema.safeParse({
      department: 'IT', role: 'admin', search: 'สมชาย', page: '2', limit: '10',
    });
    expect(result.success).toBe(true);
  });

  test('invalid role rejected', () => {
    expect(listEmployeesSchema.safeParse({ role: 'superadmin' }).success).toBe(false);
  });

  test('limit max 200', () => {
    expect(listEmployeesSchema.safeParse({ limit: '201' }).success).toBe(false);
  });
});
