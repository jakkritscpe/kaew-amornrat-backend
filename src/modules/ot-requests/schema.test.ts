import { describe, expect, test } from 'bun:test';
import { submitOTSchema, updateOTStatusSchema, listOTSchema } from './schema';

describe('submitOTSchema', () => {
  test('valid request', () => {
    const result = submitOTSchema.safeParse({
      date: '2026-03-19', startTime: '18:00', endTime: '20:00', reason: 'งานด่วน',
    });
    expect(result.success).toBe(true);
  });

  test('night shift OT (crosses midnight) is valid', () => {
    // 22:00 → 02:00 = 4 hours OT
    expect(submitOTSchema.safeParse({
      date: '2026-03-19', startTime: '22:00', endTime: '02:00', reason: 'กะดึก',
    }).success).toBe(true);
  });

  test('same startTime and endTime is invalid', () => {
    expect(submitOTSchema.safeParse({
      date: '2026-03-19', startTime: '18:00', endTime: '18:00', reason: 'งานด่วน',
    }).success).toBe(false);
  });

  test('OT over 12 hours is invalid', () => {
    // 06:00 → 19:00 = 13 hours
    expect(submitOTSchema.safeParse({
      date: '2026-03-19', startTime: '06:00', endTime: '19:00', reason: 'งานด่วน',
    }).success).toBe(false);
  });

  test('reason required (min 1)', () => {
    expect(submitOTSchema.safeParse({
      date: '2026-03-19', startTime: '18:00', endTime: '20:00', reason: '',
    }).success).toBe(false);
  });

  test('missing fields rejected', () => {
    expect(submitOTSchema.safeParse({}).success).toBe(false);
    expect(submitOTSchema.safeParse({ date: '2026-03-19' }).success).toBe(false);
  });
});

describe('updateOTStatusSchema', () => {
  test('approved valid', () => {
    expect(updateOTStatusSchema.safeParse({ status: 'approved' }).success).toBe(true);
  });

  test('rejected valid', () => {
    expect(updateOTStatusSchema.safeParse({ status: 'rejected' }).success).toBe(true);
  });

  test('pending not allowed', () => {
    expect(updateOTStatusSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  test('invalid status rejected', () => {
    expect(updateOTStatusSchema.safeParse({ status: 'cancelled' }).success).toBe(false);
  });
});

describe('listOTSchema', () => {
  test('empty uses defaults', () => {
    const result = listOTSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  test('valid status filters', () => {
    for (const status of ['pending', 'approved', 'rejected']) {
      expect(listOTSchema.safeParse({ status }).success).toBe(true);
    }
  });

  test('invalid status rejected', () => {
    expect(listOTSchema.safeParse({ status: 'cancelled' }).success).toBe(false);
  });

  test('with employeeId', () => {
    expect(listOTSchema.safeParse({ employeeId: 'emp_001' }).success).toBe(true);
  });
});
