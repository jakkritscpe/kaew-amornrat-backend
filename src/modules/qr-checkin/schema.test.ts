import { describe, expect, test } from 'bun:test';
import { qrCheckInBodySchema } from './schema';

describe('qrCheckInBodySchema', () => {
  test('valid coordinates', () => {
    expect(qrCheckInBodySchema.safeParse({ lat: 13.7563, lng: 100.5018 }).success).toBe(true);
  });

  test('boundary values', () => {
    expect(qrCheckInBodySchema.safeParse({ lat: -90, lng: -180 }).success).toBe(true);
    expect(qrCheckInBodySchema.safeParse({ lat: 90, lng: 180 }).success).toBe(true);
  });

  test('lat out of range', () => {
    expect(qrCheckInBodySchema.safeParse({ lat: 91, lng: 100 }).success).toBe(false);
    expect(qrCheckInBodySchema.safeParse({ lat: -91, lng: 100 }).success).toBe(false);
  });

  test('lng out of range', () => {
    expect(qrCheckInBodySchema.safeParse({ lat: 13, lng: 181 }).success).toBe(false);
    expect(qrCheckInBodySchema.safeParse({ lat: 13, lng: -181 }).success).toBe(false);
  });

  test('missing fields rejected', () => {
    expect(qrCheckInBodySchema.safeParse({}).success).toBe(false);
  });
});
