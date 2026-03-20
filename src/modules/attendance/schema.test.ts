import { describe, expect, test } from 'bun:test';
import { checkInSchema, checkOutSchema, listLogsSchema, updateLogSchema } from './schema';

describe('checkInSchema', () => {
  test('valid coordinates', () => {
    const result = checkInSchema.safeParse({ lat: 13.7563, lng: 100.5018 });
    expect(result.success).toBe(true);
  });

  test('boundary values (-90/90, -180/180)', () => {
    expect(checkInSchema.safeParse({ lat: -90, lng: -180 }).success).toBe(true);
    expect(checkInSchema.safeParse({ lat: 90, lng: 180 }).success).toBe(true);
  });

  test('lat out of range', () => {
    expect(checkInSchema.safeParse({ lat: 91, lng: 100 }).success).toBe(false);
    expect(checkInSchema.safeParse({ lat: -91, lng: 100 }).success).toBe(false);
  });

  test('lng out of range', () => {
    expect(checkInSchema.safeParse({ lat: 13, lng: 181 }).success).toBe(false);
    expect(checkInSchema.safeParse({ lat: 13, lng: -181 }).success).toBe(false);
  });

  test('missing fields', () => {
    expect(checkInSchema.safeParse({}).success).toBe(false);
    expect(checkInSchema.safeParse({ lat: 13 }).success).toBe(false);
    expect(checkInSchema.safeParse({ lng: 100 }).success).toBe(false);
  });

  test('string values rejected', () => {
    expect(checkInSchema.safeParse({ lat: '13', lng: '100' }).success).toBe(false);
  });
});

describe('checkOutSchema', () => {
  test('valid coordinates', () => {
    expect(checkOutSchema.safeParse({ lat: 13.7563, lng: 100.5018 }).success).toBe(true);
  });

  test('invalid coordinates rejected', () => {
    expect(checkOutSchema.safeParse({ lat: 100, lng: 200 }).success).toBe(false);
  });
});

describe('listLogsSchema', () => {
  test('empty object uses defaults', () => {
    const result = listLogsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  test('all optional fields', () => {
    const result = listLogsSchema.safeParse({
      employeeId: 'emp_123',
      date: '2026-03-19',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      status: 'present',
      page: '2',
      limit: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
    }
  });

  test('valid status values', () => {
    for (const status of ['present', 'late', 'absent', 'on_leave']) {
      expect(listLogsSchema.safeParse({ status }).success).toBe(true);
    }
  });

  test('invalid status rejected', () => {
    expect(listLogsSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });

  test('limit max 200', () => {
    expect(listLogsSchema.safeParse({ limit: '201' }).success).toBe(false);
    expect(listLogsSchema.safeParse({ limit: '200' }).success).toBe(true);
  });

  test('page must be positive', () => {
    expect(listLogsSchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listLogsSchema.safeParse({ page: '-1' }).success).toBe(false);
  });
});

describe('updateLogSchema', () => {
  test('empty object is valid (all optional)', () => {
    expect(updateLogSchema.safeParse({}).success).toBe(true);
  });

  test('partial update with status', () => {
    const result = updateLogSchema.safeParse({ status: 'late' });
    expect(result.success).toBe(true);
  });

  test('partial update with times', () => {
    const result = updateLogSchema.safeParse({
      checkInTime: '2026-03-19T08:00:00Z',
      checkOutTime: '2026-03-19T17:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  test('partial update with hours', () => {
    const result = updateLogSchema.safeParse({ workHours: 8, otHours: 2 });
    expect(result.success).toBe(true);
  });

  test('invalid status rejected', () => {
    expect(updateLogSchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });
});
