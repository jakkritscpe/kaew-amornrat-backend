import { describe, expect, test, mock, beforeEach } from 'bun:test';

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelectChain = {
  from: mock(() => mockSelectChain),
  where: mock(() => mockSelectChain),
  limit: mock(() => mockSelectChain),
  then: (resolve: (v: unknown) => void) => resolve([]),
};
const mockSelect = mock(() => mockSelectChain);

mock.module('../../db', () => ({
  db: { select: mockSelect, insert: mock(() => ({ values: mock(() => Promise.resolve()) })) },
}));

mock.module('../../db/schema', () => ({
  employees: {
    id: 'id', name: 'name', email: 'email', passwordHash: 'password_hash',
    role: 'role', department: 'department', position: 'position',
    qrToken: 'qr_token', accessibleMenus: 'accessible_menus',
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

const { loginService, qrLoginService } = await import('./service');

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupSelectReturn(value: unknown) {
  const chain = {
    from: mock(() => chain),
    where: mock(() => chain),
    limit: mock(() => chain),
    then: (resolve: (v: unknown) => void) => resolve(value),
  };
  mockSelect.mockReturnValue(chain as any);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('loginService', () => {
  beforeEach(() => mockSelect.mockClear());

  test('throws 401 for non-existent email', async () => {
    setupSelectReturn([]);
    try {
      await loginService('nobody@test.com', 'password');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toBe('Invalid credentials');
      expect(err.status).toBe(401);
    }
  });

  test('throws 401 for wrong password', async () => {
    const hashedCorrect = await Bun.password.hash('correct_password');
    setupSelectReturn([{
      id: 'emp_001', name: 'Test', email: 'test@test.com',
      passwordHash: hashedCorrect, role: 'employee',
      department: 'IT', position: 'Dev', accessibleMenus: null,
    }]);

    try {
      await loginService('test@test.com', 'wrong_password');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toBe('Invalid credentials');
      expect(err.status).toBe(401);
    }
  });

  test('returns token and user for valid credentials', async () => {
    const hashedPassword = await Bun.password.hash('correct_password');
    setupSelectReturn([{
      id: 'emp_001', name: 'Test User', email: 'test@test.com',
      passwordHash: hashedPassword, role: 'admin',
      department: 'IT', position: 'Dev', accessibleMenus: '["dashboard"]',
    }]);

    // Set JWT_SECRET for signing
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-to-pass-validation';

    try {
      const result = await loginService('test@test.com', 'correct_password');
      expect(result.token).toBeDefined();
      expect(result.token.split('.').length).toBe(3); // JWT format
      expect(result.user.id).toBe('emp_001');
      expect(result.user.name).toBe('Test User');
      expect(result.user.role).toBe('admin');
      expect(result.user.accessibleMenus).toEqual(['dashboard']);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});

describe('qrLoginService', () => {
  beforeEach(() => mockSelect.mockClear());

  test('throws 401 for invalid QR token', async () => {
    setupSelectReturn([]);
    try {
      await qrLoginService('invalid-qr-token');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain('QR code');
      expect(err.status).toBe(401);
    }
  });

  test('returns token and user for valid QR token', async () => {
    setupSelectReturn([{
      id: 'emp_002', name: 'QR User', email: 'qr@test.com',
      passwordHash: 'hash', role: 'employee', qrToken: 'valid-qr-token',
      department: 'HR', position: 'Staff', accessibleMenus: null,
    }]);

    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-to-pass-validation';

    try {
      const result = await qrLoginService('valid-qr-token');
      expect(result.token).toBeDefined();
      expect(result.user.id).toBe('emp_002');
      expect(result.user.accessibleMenus).toEqual([]);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});
