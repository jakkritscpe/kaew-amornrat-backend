// Parse "HH:MM" to minutes since midnight
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Calculate work hours between two ISO datetime strings
export function calculateWorkHours(checkIn: string, checkOut: string): number {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, diff / (1000 * 60 * 60)); // hours
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

// Get today's date as YYYY-MM-DD
export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Check if employee is late (more than 15 minutes after shift start)
export function isLate(shiftStart: string, checkInTime: string): boolean {
  const shiftMinutes = timeToMinutes(shiftStart);
  const checkInDate = new Date(checkInTime);
  const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
  return checkInMinutes > shiftMinutes + 15;
}
