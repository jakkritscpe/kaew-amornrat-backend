import { describe, expect, test } from 'bun:test';
import { createLocationSchema, updateLocationSchema } from './schema';

describe('createLocationSchema', () => {
  test('valid with all fields', () => {
    const result = createLocationSchema.safeParse({
      name: 'สำนักงานใหญ่', lat: 13.7563, lng: 100.5018, radiusMeters: 300,
    });
    expect(result.success).toBe(true);
  });

  test('default radiusMeters = 200', () => {
    const result = createLocationSchema.safeParse({
      name: 'Office', lat: 13.7563, lng: 100.5018,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radiusMeters).toBe(200);
    }
  });

  test('name required (min 1)', () => {
    expect(createLocationSchema.safeParse({ name: '', lat: 0, lng: 0 }).success).toBe(false);
    expect(createLocationSchema.safeParse({ lat: 0, lng: 0 }).success).toBe(false);
  });

  test('negative radiusMeters rejected', () => {
    expect(createLocationSchema.safeParse({
      name: 'Office', lat: 0, lng: 0, radiusMeters: -1,
    }).success).toBe(false);
  });

  test('zero radiusMeters rejected (must be positive)', () => {
    expect(createLocationSchema.safeParse({
      name: 'Office', lat: 0, lng: 0, radiusMeters: 0,
    }).success).toBe(false);
  });
});

describe('updateLocationSchema', () => {
  test('empty object valid (all partial)', () => {
    expect(updateLocationSchema.safeParse({}).success).toBe(true);
  });

  test('partial update name only', () => {
    expect(updateLocationSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  test('partial update coordinates', () => {
    expect(updateLocationSchema.safeParse({ lat: 14.0, lng: 101.0 }).success).toBe(true);
  });
});
