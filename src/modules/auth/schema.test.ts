import { describe, expect, test } from 'bun:test';
import { loginSchema } from './schema';

describe('loginSchema', () => {
  test('valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'test@test.com', password: 'password123' }).success).toBe(true);
  });

  test('invalid email format', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'password123' }).success).toBe(false);
  });

  test('empty email', () => {
    expect(loginSchema.safeParse({ email: '', password: 'password123' }).success).toBe(false);
  });

  test('password too short (min 8)', () => {
    expect(loginSchema.safeParse({ email: 'test@test.com', password: '1234567' }).success).toBe(false);
  });

  test('password exactly 8 chars', () => {
    expect(loginSchema.safeParse({ email: 'test@test.com', password: '12345678' }).success).toBe(true);
  });

  test('missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'test@test.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ password: '12345678' }).success).toBe(false);
  });
});
