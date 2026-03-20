import { describe, expect, test } from 'bun:test';
import { updateSettingsSchema } from './schema';

describe('updateSettingsSchema', () => {
  test('empty object valid (all optional)', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(true);
  });

  test('valid multiplier type', () => {
    expect(updateSettingsSchema.safeParse({
      defaultOtRateType: 'multiplier', defaultOtRateValue: 1.5,
    }).success).toBe(true);
  });

  test('valid fixed type', () => {
    expect(updateSettingsSchema.safeParse({
      defaultOtRateType: 'fixed', defaultOtRateValue: 500,
    }).success).toBe(true);
  });

  test('invalid type rejected', () => {
    expect(updateSettingsSchema.safeParse({ defaultOtRateType: 'hourly' }).success).toBe(false);
  });

  test('negative rate rejected', () => {
    expect(updateSettingsSchema.safeParse({ defaultOtRateValue: -1 }).success).toBe(false);
  });

  test('zero rate rejected', () => {
    expect(updateSettingsSchema.safeParse({ defaultOtRateValue: 0 }).success).toBe(false);
  });

  test('partial update type only', () => {
    expect(updateSettingsSchema.safeParse({ defaultOtRateType: 'fixed' }).success).toBe(true);
  });
});
