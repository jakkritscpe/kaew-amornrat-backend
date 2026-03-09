export interface JWTPayload {
  sub: string; // employee id
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'manager';
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
