// Application-level constants — edit here to change behaviour app-wide

/** Grace period in minutes after shift start before marking late */
export const LATE_THRESHOLD_MINUTES = 15;

/** Default OT rate multiplier when no custom rate is set */
export const DEFAULT_OT_RATE = 1.5;

/** Maximum coordinate bounds (rough global sanity check) */
export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LNG_MIN = -180;
export const LNG_MAX = 180;

/** Maximum allowed OT rate value (covers multiplier ≤10× and fixed-rate cap) */
export const MAX_OT_RATE = 10;
