import type { Response } from "express";

interface SuccessBody<T> {
  _status: true;
  _message?: string;
  _data?: T;
  _token?: string;
  [key: string]: unknown;
}

interface FailureBody {
  _status: false;
  _message: string;
  _error?: unknown;
  _data?: unknown;
}

export const success = <T>(
  res: Response,
  data?: T,
  message?: string,
  status = 200,
  extras?: Record<string, unknown>,
): Response<SuccessBody<T>> => {
  const body: SuccessBody<T> = { _status: true };
  if (message) body._message = message;
  if (data !== undefined) body._data = data;
  if (extras) Object.assign(body, extras);
  return res.status(status).json(body);
};

export const fail = (
  res: Response,
  message: string,
  status = 400,
  error?: unknown,
): Response<FailureBody> => {
  const body: FailureBody = { _status: false, _message: message };
  if (error !== undefined && process.env.NODE_ENV === "development") {
    body._error = error instanceof Error ? error.message : error;
  }
  return res.status(status).json(body);
};
