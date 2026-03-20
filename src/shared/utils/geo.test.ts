import { describe, expect, test } from 'bun:test';
import { calculateDistance, isWithinRadius } from './geo';

describe('calculateDistance (Haversine)', () => {
  test('same point returns 0', () => {
    expect(calculateDistance(13.7563, 100.5018, 13.7563, 100.5018)).toBe(0);
  });

  test('Bangkok to Chiang Mai ≈ 580 km', () => {
    const dist = calculateDistance(13.7563, 100.5018, 18.7883, 98.9853);
    // ±10 km tolerance
    expect(dist).toBeGreaterThan(570_000);
    expect(dist).toBeLessThan(590_000);
  });

  test('short distance ~100m', () => {
    // Two points roughly 100m apart in Bangkok
    const dist = calculateDistance(13.7563, 100.5018, 13.7572, 100.5018);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(120);
  });

  test('cross equator distance is positive', () => {
    const dist = calculateDistance(-1.0, 100.0, 1.0, 100.0);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('isWithinRadius', () => {
  const officeLat = 13.7563;
  const officeLng = 100.5018;
  const radius = 200; // meters

  test('same point → within radius', () => {
    expect(isWithinRadius(officeLat, officeLng, officeLat, officeLng, radius)).toBe(true);
  });

  test('point inside radius → true', () => {
    // ~50m offset
    expect(isWithinRadius(13.7567, 100.5018, officeLat, officeLng, radius)).toBe(true);
  });

  test('point outside radius → false', () => {
    // ~1km offset
    expect(isWithinRadius(13.7663, 100.5018, officeLat, officeLng, radius)).toBe(false);
  });

  test('point at edge of radius → true', () => {
    // ~180m offset (within 200m)
    expect(isWithinRadius(13.7579, 100.5018, officeLat, officeLng, radius)).toBe(true);
  });

  test('very large radius includes far points', () => {
    expect(isWithinRadius(14.0, 100.5, officeLat, officeLng, 100_000)).toBe(true);
  });
});
