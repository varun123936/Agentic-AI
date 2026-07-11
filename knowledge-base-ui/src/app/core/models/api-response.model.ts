// Generic wrapper that matches your Express.js response format
// { success: true, data: {...} } or { success: false, error: '...' }

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  message?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number;
  page?: number;
  limit?: number;
}