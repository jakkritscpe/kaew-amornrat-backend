import { describe, expect, test, beforeEach, mock } from 'bun:test';

// ─── Mock modules BEFORE importing the service ─────────────────────────────

// Mock DB
const mockSelect = mock(() => mockSelectChain);
const mockInsert = mock(() => ({ values: mock(() => Promise.resolve()) }));
const mockUpdateSet = mock(() => ({ where: mock(() => Promise.resolve()) }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));
const mockSelectChain = {
  from: mock(() => mockSelectChain),
  leftJoin: mock(() => mockSelectChain),
  where: mock(() => mockSelectChain),
  orderBy: mock(() => mockSelectChain),
  limit: mock(() => mockSelectChain),
  offset: mock(() => mockSelectChain),
};

mock.module('../../db', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

mock.module('../../db/schema', () => ({
  attendanceLogs: {
    id: 'id',
    employeeId: 'employee_id',
    date: 'date',
    checkInTime: 'check_in_time',
    checkOutTime: 'check_out_time',
    status: 'status',
  },
  employees: {
    id: 'id',
    name: 'name',
    department: 'department',
  },
}));

// Mock employee service
const mockGetEmployee = mock(() =>
  Promise.resolve({
    id: 'emp_001',
    name: 'สมชาย ใจดี',
    email: 'somchai@test.com',
    department: 'IT',
    position: 'Developer',
    role: 'employee' as const,
    shiftStartTime: '08:00',
    shiftEndTime: '17:00',
    locationId: 'loc_001',
    accessibleMenus: [],
  })
);

mock.module('../employees/service', () => ({
  getEmployee: mockGetEmployee,
}));

// Mock locations service
const mockListLocations = mock(() =>
  Promise.resolve([
    { id: 'loc_001', name: 'สำนักงานใหญ่', lat: 13.7563, lng: 100.5018, radiusMeters: 200 },
  ])
);

mock.module('../locations/service', () => ({
  listLocations: mockListLocations,
}));

// Mock WebSocket manager
const mockBroadcast = mock(() => {});

mock.module('../../shared/ws/manager', () => ({
  wsManager: { broadcast: mockBroadcast },
}));

// Mock time utilities (selectively)
const originalTime = await import('../../shared/utils/time');

mock.module('../../shared/utils/time', () => ({
  ...originalTime,
  todayDate: () => '2026-03-19',
}));

// Now import the service (after mocks are set up)
const { getTodayLog, checkIn, checkOut, updateLog, getLogs } = await import('./service');

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  mockGetEmployee.mockClear();
  mockListLocations.mockClear();
  mockBroadcast.mockClear();
  mockSelect.mockClear();
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();

  // Reset chain mocks
  for (const key of Object.keys(mockSelectChain) as (keyof typeof mockSelectChain)[]) {
    (mockSelectChain[key] as ReturnType<typeof mock>).mockClear();
  }
}

function setupSelectReturn(value: unknown) {
  // Make the chain resolve to the value when awaited (Promise-like)
  const chain = {
    from: mock(() => chain),
    leftJoin: mock(() => chain),
    where: mock(() => chain),
    orderBy: mock(() => chain),
    limit: mock(() => chain),
    offset: mock(() => chain),
    then: (resolve: (v: unknown) => void) => resolve(value),
  };
  mockSelect.mockReturnValue(chain as any);
  return chain;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getTodayLog', () => {
  beforeEach(resetMocks);

  test('returns log when found', async () => {
    const mockLog = {
      id: 'log_001',
      employeeId: 'emp_001',
      date: '2026-03-19',
      checkInTime: new Date('2026-03-19T01:00:00Z'),
      status: 'present',
    };
    setupSelectReturn([mockLog]);

    const result = await getTodayLog('emp_001');
    expect(result).toEqual(mockLog);
  });

  test('returns null when not found', async () => {
    setupSelectReturn([]);

    const result = await getTodayLog('emp_999');
    expect(result).toBeNull();
  });
});

describe('checkIn', () => {
  beforeEach(resetMocks);

  test('throws if already checked in', async () => {
    const existingLog = {
      id: 'log_001',
      checkInTime: new Date('2026-03-19T01:00:00Z'),
    };
    setupSelectReturn([existingLog]);

    try {
      await checkIn('emp_001', 13.7563, 100.5018);
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toBe('Already checked in today');
      expect(err.status).toBe(400);
    }
  });

  test('throws if outside geofence', async () => {
    // No existing log
    setupSelectReturn([]);

    mockGetEmployee.mockResolvedValue({
      id: 'emp_001',
      name: 'สมชาย',
      nickname: null,
      email: 'somchai@test.com',
      department: 'IT',
      position: 'Developer',
      role: 'employee' as const,
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      locationId: 'loc_001',
      baseWage: null,
      otRateUseDefault: true,
      otRateType: null,
      otRateValue: null,
      avatarUrl: null,
      qrToken: null,
      accessibleMenus: [],
      createdAt: new Date(),
    });

    try {
      // Far from office (14.0 vs 13.7563)
      await checkIn('emp_001', 14.0, 100.5018);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain('นอกพื้นที่');
      expect(err.status).toBe(400);
    }
  });

  test('check-in without location does not check geofence', async () => {
    setupSelectReturn([]);

    // Employee without locationId
    mockGetEmployee.mockResolvedValue({
      id: 'emp_002',
      name: 'สมหญิง',
      nickname: null,
      email: 'somying@test.com',
      department: 'HR',
      position: 'Manager',
      role: 'employee' as const,
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      locationId: null,
      baseWage: null,
      otRateUseDefault: true,
      otRateType: null,
      otRateValue: null,
      avatarUrl: null,
      qrToken: null,
      accessibleMenus: [],
      createdAt: new Date(),
    });

    // Should insert and not throw even with far coordinates
    const insertValues = mock(() => Promise.resolve());
    mockInsert.mockReturnValue({ values: insertValues } as any);

    // Mock the second getTodayLog call that happens at the end
    const mockLogResult = {
      id: 'log_new',
      employeeId: 'emp_002',
      date: '2026-03-19',
      checkInTime: new Date(),
      status: 'present',
    };

    // First call returns [] (no existing), subsequent calls for getTodayLog return the log
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      const chain = {
        from: mock(() => chain),
        leftJoin: mock(() => chain),
        where: mock(() => chain),
        orderBy: mock(() => chain),
        limit: mock(() => chain),
        offset: mock(() => chain),
        then: (resolve: (v: unknown) => void) => {
          resolve(callCount === 1 ? [] : [mockLogResult]);
        },
      };
      return chain as any;
    });

    const result = await checkIn('emp_002', 50.0, 50.0);
    expect(insertValues).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalled();
  });
});

describe('checkOut', () => {
  beforeEach(resetMocks);

  test('throws if not checked in', async () => {
    setupSelectReturn([]);

    try {
      await checkOut('emp_001', 13.7563, 100.5018);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain('ยังไม่ได้ check-in');
      expect(err.status).toBe(400);
    }
  });

  test('throws if already checked out', async () => {
    const log = {
      id: 'log_001',
      checkInTime: new Date('2026-03-19T01:00:00Z'),
      checkOutTime: new Date('2026-03-19T10:00:00Z'),
    };
    setupSelectReturn([log]);

    try {
      await checkOut('emp_001', 13.7563, 100.5018);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain('Check-out แล้ว');
      expect(err.status).toBe(400);
    }
  });

  test('successful checkout updates log and broadcasts', async () => {
    const log = {
      id: 'log_001',
      checkInTime: new Date('2026-03-19T01:00:00Z'),
      checkOutTime: null,
    };

    let callCount = 0;
    const mockWhere = mock(() => Promise.resolve());
    mockUpdate.mockReturnValue({
      set: mock(() => ({ where: mockWhere })),
    } as any);

    mockSelect.mockImplementation(() => {
      callCount++;
      const chain = {
        from: mock(() => chain),
        where: mock(() => chain),
        limit: mock(() => chain),
        then: (resolve: (v: unknown) => void) => {
          if (callCount === 1) {
            resolve([log]);
          } else {
            resolve([{ ...log, checkOutTime: new Date(), workHours: 8, otHours: 0 }]);
          }
        },
      };
      return chain as any;
    });

    const result = await checkOut('emp_001', 13.7563, 100.5018);
    expect(mockBroadcast).toHaveBeenCalled();

    // Verify the broadcast was called with CHECK_OUT event type
    const broadcastCall = mockBroadcast.mock.calls[0];
    expect(broadcastCall[0]).toHaveProperty('type', 'CHECK_OUT');
  });
});

describe('updateLog', () => {
  beforeEach(resetMocks);

  test('updates partial fields', async () => {
    const mockWhere = mock(() => Promise.resolve());
    mockUpdate.mockReturnValue({
      set: mock(() => ({ where: mockWhere })),
    } as any);

    await updateLog('log_001', { status: 'late' });
    expect(mockUpdate).toHaveBeenCalled();
  });

  test('converts checkInTime string to Date', async () => {
    const mockSetFn = mock(() => ({ where: mock(() => Promise.resolve()) }));
    mockUpdate.mockReturnValue({ set: mockSetFn } as any);

    await updateLog('log_001', { checkInTime: '2026-03-19T08:00:00Z' });

    const setArg = mockSetFn.mock.calls[0][0];
    expect(setArg.checkInTime).toBeInstanceOf(Date);
  });

  test('converts checkOutTime string to Date', async () => {
    const mockSetFn = mock(() => ({ where: mock(() => Promise.resolve()) }));
    mockUpdate.mockReturnValue({ set: mockSetFn } as any);

    await updateLog('log_001', { checkOutTime: '2026-03-19T17:00:00Z' });

    const setArg = mockSetFn.mock.calls[0][0];
    expect(setArg.checkOutTime).toBeInstanceOf(Date);
  });
});
