import { describe, expect, test } from 'bun:test';
import { timeToMinutes, calculateWorkHours, calculateOTHours, todayDate, isLate, minutesLate } from './time';

describe('timeToMinutes', () => {
  test('"08:00" → 480', () => {
    expect(timeToMinutes('08:00')).toBe(480);
  });

  test('"00:00" → 0', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  test('"17:30" → 1050', () => {
    expect(timeToMinutes('17:30')).toBe(1050);
  });

  test('"23:59" → 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  test('"12:00" → 720 (noon)', () => {
    expect(timeToMinutes('12:00')).toBe(720);
  });
});

describe('calculateWorkHours', () => {
  test('8 hours work', () => {
    const result = calculateWorkHours(
      '2026-03-19T08:00:00.000Z',
      '2026-03-19T16:00:00.000Z'
    );
    expect(result).toBe(8);
  });

  test('0 hours (same time)', () => {
    const result = calculateWorkHours(
      '2026-03-19T08:00:00.000Z',
      '2026-03-19T08:00:00.000Z'
    );
    expect(result).toBe(0);
  });

  test('partial hours', () => {
    const result = calculateWorkHours(
      '2026-03-19T08:00:00.000Z',
      '2026-03-19T12:30:00.000Z'
    );
    expect(result).toBe(4.5);
  });

  test('checkout before checkin returns 0 (not negative)', () => {
    const result = calculateWorkHours(
      '2026-03-19T16:00:00.000Z',
      '2026-03-19T08:00:00.000Z'
    );
    expect(result).toBe(0);
  });
});

describe('calculateOTHours', () => {
  test('no OT when working exact shift hours', () => {
    // shift 08:00–17:00 = 9 hours
    expect(calculateOTHours(9, '08:00', '17:00')).toBe(0);
  });

  test('OT when working more than shift', () => {
    // shift 08:00–17:00 = 9 hours, worked 11 hours → 2 hours OT
    expect(calculateOTHours(11, '08:00', '17:00')).toBe(2);
  });

  test('no OT when working less than shift', () => {
    expect(calculateOTHours(5, '08:00', '17:00')).toBe(0);
  });

  test('fractional OT hours', () => {
    expect(calculateOTHours(9.5, '08:00', '17:00')).toBeCloseTo(0.5, 2);
  });
});

describe('todayDate', () => {
  test('returns YYYY-MM-DD format', () => {
    const result = todayDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('returns a valid date', () => {
    const result = todayDate();
    const parsed = new Date(result);
    expect(parsed.toString()).not.toBe('Invalid Date');
  });
});

describe('isLate', () => {
  // Note: isLate uses Bangkok timezone (UTC+7)
  // LATE_THRESHOLD_MINUTES = 15
  // So for shift "08:00", late if check-in after 08:15 Bangkok time

  test('on-time check-in → not late', () => {
    // 08:00 Bangkok = 01:00 UTC
    expect(isLate('08:00', '2026-03-19T01:00:00.000Z')).toBe(false);
  });

  test('within grace period → not late', () => {
    // 08:14 Bangkok = 01:14 UTC (within 15 min threshold)
    expect(isLate('08:00', '2026-03-19T01:14:00.000Z')).toBe(false);
  });

  test('at threshold boundary → not late', () => {
    // 08:15 Bangkok = 01:15 UTC (exactly at threshold, not strictly ">")
    expect(isLate('08:00', '2026-03-19T01:15:00.000Z')).toBe(false);
  });

  test('past threshold → late', () => {
    // 08:16 Bangkok = 01:16 UTC (> 15 min)
    expect(isLate('08:00', '2026-03-19T01:16:00.000Z')).toBe(true);
  });

  test('very late → late', () => {
    // 10:00 Bangkok = 03:00 UTC
    expect(isLate('08:00', '2026-03-19T03:00:00.000Z')).toBe(true);
  });

  test('early check-in → not late', () => {
    // 07:00 Bangkok = 00:00 UTC
    expect(isLate('08:00', '2026-03-19T00:00:00.000Z')).toBe(false);
  });
});

describe('minutesLate', () => {
  test('on-time → 0 minutes late', () => {
    // 08:00 Bangkok = 01:00 UTC
    expect(minutesLate('08:00', '2026-03-19T01:00:00.000Z')).toBe(0);
  });

  test('30 minutes late', () => {
    // 08:30 Bangkok = 01:30 UTC
    expect(minutesLate('08:00', '2026-03-19T01:30:00.000Z')).toBe(30);
  });

  test('early → 0 minutes late', () => {
    // 07:30 Bangkok = 00:30 UTC
    expect(minutesLate('08:00', '2026-03-19T00:30:00.000Z')).toBe(0);
  });
});
