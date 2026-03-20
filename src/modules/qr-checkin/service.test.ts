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
  db: { select: mockSelect },
}));

mock.module('../../db/schema', () => ({
  employees: { id: 'id', name: 'name', position: 'position', avatarUrl: 'avatar_url', qrToken: 'qr_token' },
}));

// Mock the attendance service that qr-checkin depends on
const mockCheckIn = mock(() => Promise.resolve({ id: 'log_new', status: 'present' }));
const mockCheckOut = mock(() => Promise.resolve({ id: 'log_001', status: 'present', workHours: 8 }));
const mockGetTodayLog = mock(() => Promise.resolve(null));

mock.module('../attendance/service', () => ({
  checkIn: mockCheckIn,
  checkOut: mockCheckOut,
  getTodayLog: mockGetTodayLog,
}));

const { getEmployeePublicInfo, qrCheckIn } = await import('./service');

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  mockSelect.mockClear();
  mockCheckIn.mockClear();
  mockCheckOut.mockClear();
  mockGetTodayLog.mockClear();
}

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

describe('getEmployeePublicInfo', () => {
  beforeEach(resetMocks);

  test('returns public info when found by qrToken', async () => {
    setupSelectReturn([{ id: 'emp_001', name: 'สมชาย', position: 'Dev', avatarUrl: null }]);
    const result = await getEmployeePublicInfo('some-uuid-token');
    expect(result.id).toBe('emp_001');
    expect(result.name).toBe('สมชาย');
  });

  test('throws 404 when qrToken not found', async () => {
    setupSelectReturn([]);
    try {
      await getEmployeePublicInfo('invalid-token');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toBe('Employee not found');
      expect(err.status).toBe(404);
    }
  });
});

describe('qrCheckIn', () => {
  beforeEach(resetMocks);

  test('check-in when no existing log', async () => {
    setupSelectReturn([{ id: 'emp_001' }]);
    mockGetTodayLog.mockResolvedValue(null);
    const result = await qrCheckIn('some-uuid-token', 13.7563, 100.5018);
    expect(result.action).toBe('check-in');
    expect(mockCheckIn).toHaveBeenCalledWith('emp_001', 13.7563, 100.5018);
  });

  test('check-out when already checked in but not out', async () => {
    setupSelectReturn([{ id: 'emp_001' }]);
    mockGetTodayLog.mockResolvedValue({
      id: 'log_001', checkInTime: new Date(), checkOutTime: null,
    } as any);
    const result = await qrCheckIn('some-uuid-token', 13.7563, 100.5018);
    expect(result.action).toBe('check-out');
    expect(mockCheckOut).toHaveBeenCalledWith('emp_001', 13.7563, 100.5018);
  });

  test('check-in when already fully checked in/out (new day)', async () => {
    setupSelectReturn([{ id: 'emp_001' }]);
    mockGetTodayLog.mockResolvedValue({
      id: 'log_001', checkInTime: new Date(), checkOutTime: new Date(),
    } as any);
    // When both checkInTime and checkOutTime exist, condition `checkInTime && !checkOutTime` is false
    const result = await qrCheckIn('some-uuid-token', 13.7563, 100.5018);
    expect(result.action).toBe('check-in');
    expect(mockCheckIn).toHaveBeenCalled();
  });
});
