export interface ApiSuccess<T> {
  _status: true;
  _message?: string;
  data: T;
}

export interface ApiFailure {
  _status: false;
  _message: string;
  _error?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}