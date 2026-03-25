import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../../db';
import { employees } from '../../db/schema';
import { unauthorized } from '../../shared/utils/errors';

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

async function signJWT(payload: Record<string, unknown>, secret: string, expiresIn?: number): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64url = (obj: unknown) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return Buffer.from(bytes).toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (expiresIn ?? 60 * 60 * 24 * 7),
  };

  const message = `${b64url(header)}.${b64url(claims)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${message}.${sigB64}`;
}

// Dummy hash used when email not found — ensures constant-time response to prevent email enumeration.
// Generated at startup so it matches the bcrypt format of the current runtime.
const DUMMY_HASH = await Bun.password.hash('__dummy_placeholder__');

export async function loginService(email: string, password: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.email, email), isNull(employees.deletedAt)))
    .limit(1);

  const hashToVerify = employee?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hashToVerify);
  if (!valid || !employee) {
    throw unauthorized('Invalid credentials');
  }

  const token = await signJWT(
    { sub: employee.id, name: employee.name, role: employee.role, email: employee.email },
    process.env.JWT_SECRET!
  );

  return {
    token,
    user: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      position: employee.position,
      accessibleMenus: (() => { try { return employee.accessibleMenus ? JSON.parse(employee.accessibleMenus) : []; } catch { return []; } })(),
    },
  };
}

export async function qrLoginService(qrToken: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.qrToken, qrToken), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw unauthorized('QR code ไม่ถูกต้องหรือหมดอายุ');
  }

  if (employee.qrTokenExpiresAt && employee.qrTokenExpiresAt < new Date()) {
    throw unauthorized('QR code หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อออก QR ใหม่');
  }

  // Issue 30-day JWT
  const token = await signJWT(
    { sub: employee.id, name: employee.name, role: employee.role, email: employee.email },
    process.env.JWT_SECRET!,
    30 * 24 * 60 * 60 // 30 days in seconds
  );

  return {
    token,
    user: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      position: employee.position,
      accessibleMenus: (() => { try { return employee.accessibleMenus ? JSON.parse(employee.accessibleMenus) : []; } catch { return []; } })(),
    },
  };
}

export { hashPassword };
