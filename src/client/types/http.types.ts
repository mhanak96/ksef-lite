export interface HttpClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  responseType?: 'json' | 'text' | 'buffer';
}

export interface HttpError extends Error {
  status: number;
  statusText: string;
  data?: any;
  url?: string;
  method?: string;
  retryAfterSec?: number;
}

export interface TimeoutError extends Error {
  isTimeout: true;
  url?: string;
  method?: string;
}

export interface ErrorDetails {
  message: string;
  type: 'http' | 'timeout' | 'unknown';
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: any;
}
