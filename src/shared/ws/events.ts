export type NotificationEventType =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'LATE'
  | 'OT_REQUEST'
  | 'OT_APPROVED'
  | 'OT_REJECTED';

export interface NotificationEvent {
  type: NotificationEventType;
  id: string;           // unique event id
  timestamp: string;    // ISO string
  employeeId: string;
  employeeName: string;
  meta: Record<string, unknown>;
}

export function createEvent(
  type: NotificationEventType,
  employeeId: string,
  employeeName: string,
  meta: Record<string, unknown> = {}
): NotificationEvent {
  return {
    type,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    employeeId,
    employeeName,
    meta,
  };
}
