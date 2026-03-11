import { LATE_THRESHOLD_MINUTES } from '../config';

/** IANA timezone for all business-logic date/time operations */
const TZ = 'Asia/Bangkok';

// Parse "HH:MM" to minutes since midnight
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Calculate work hours between two ISO datetime strings
export function calculateWorkHours(checkIn: string, checkOut: string): number {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
}

// Calculate OT hours
export function calculateOTHours(
  workHours: number,
  shiftStart: string,
  shiftEnd: string
): number {
  const shiftHours = (timeToMinutes(shiftEnd) - timeToMinutes(shiftStart)) / 60;
  return Math.max(0, workHours - shiftHours);
}

// Get today's date as YYYY-MM-DD in Bangkok time
export function todayDate(): string {
  // 'en-CA' locale produces YYYY-MM-DD format natively
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// Extract wall-clock hours and minutes in Bangkok timezone
function getBangkokTime(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find(p => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find(p => p.type === 'minute')?.value ?? 0),
  };
}

// Check if employee is late (more than LATE_THRESHOLD_MINUTES after shift start)
export function isLate(shiftStart: string, checkInTime: string): boolean {
  const shiftMinutes = timeToMinutes(shiftStart);
  const { hour, minute } = getBangkokTime(new Date(checkInTime));
  return hour * 60 + minute > shiftMinutes + LATE_THRESHOLD_MINUTES;
}

// Get minutes late relative to shift start (Bangkok time)
export function minutesLate(shiftStart: string, checkInTime: string): number {
  const shiftMinutes = timeToMinutes(shiftStart);
  const { hour, minute } = getBangkokTime(new Date(checkInTime));
  return Math.max(0, hour * 60 + minute - shiftMinutes);
}
