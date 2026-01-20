import { HttpClientOptions, HttpError, TimeoutError, ErrorDetails } from "./types";

export class HttpClient {
  private baseUrl: string;
  private debug: boolean;

  constructor(baseUrl: string, debug = false) {
    this.baseUrl = baseUrl;
    this.debug = debug;
  }

  async request<T = any>(endpoint: string, options: HttpClientOptions = {}): Promise<T> {
    const { method = "GET", headers = {}, body, timeoutMs = 20000, responseType = "json" } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();

    try {
      const isXml = typeof body === "string" && body.trim().startsWith("<?xml");
      const hasBody = body !== undefined && body !== null;
      const isJson = hasBody && !isXml;

      const requestHeaders: Record<string, string> = { ...headers };

      if (isXml) {
        requestHeaders["Content-Type"] = "application/xml";
      } else if (isJson) {
        requestHeaders["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: hasBody ? (isXml ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      });

      const elapsed = Date.now() - started;

      if (this.debug) {
        console.log(`[KSeF HTTP] ${method} ${url} -> ${response.status} (${elapsed}ms)`);
      }

      if (!response.ok) {
        await this.handleErrorResponse(response, url, method);
      }

      return await this.parseResponse<T>(response, responseType);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = new Error(`Request timeout after ${timeoutMs}ms for ${url}`) as TimeoutError;
        timeoutError.isTimeout = true;
        timeoutError.url = url;
        timeoutError.method = method;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async handleErrorResponse(response: Response, url: string, method: string): Promise<never> {
    const text = await response.text();
    let data: any;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (this.debug) {
      console.error(`❌ HTTP Error ${response.status} for ${method} ${url}`);
      console.error(`📋 Response:`, JSON.stringify(data, null, 2));
    }

    const error = new Error(`HTTP ${response.status} ${response.statusText} for ${url}`) as HttpError;
    error.status = response.status;
    error.statusText = response.statusText;
    error.data = data;
    error.url = url;
    error.method = method;

    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      const n = Number(retryAfter);
      if (Number.isFinite(n)) error.retryAfterSec = n;
    }

    throw error;
  }

  private async parseResponse<T>(response: Response, responseType: "json" | "text" | "buffer"): Promise<T> {
    switch (responseType) {
      case "text":
        return (await response.text()) as T;
      case "buffer":
        return (await response.arrayBuffer()) as T;
      case "json":
      default:
        const text = await response.text();
        if (!text) {
          return {} as T;
        }
        try {
          return JSON.parse(text) as T;
        } catch {
          return { raw: text } as T;
        }
    }
  }

  async get<T = any>(endpoint: string, options: Omit<HttpClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T = any>(endpoint: string, body?: any, options: Omit<HttpClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  async put<T = any>(endpoint: string, body?: any, options: Omit<HttpClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  async delete<T = any>(endpoint: string, options: Omit<HttpClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  async patch<T = any>(endpoint: string, body?: any, options: Omit<HttpClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }
}

/* =========================
   HELPER FUNCTIONS
   ========================= */

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && "status" in error && typeof (error as any).status === "number";
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof Error && "isTimeout" in error;
}

export function getErrorDetails(error: unknown): ErrorDetails {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
      type: "unknown",
    };
  }

  if (isTimeoutError(error)) {
    return {
      message: error.message,
      url: error.url,
      method: error.method,
      type: "timeout",
    };
  }

  if (isHttpError(error)) {
    return {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      method: error.method,
      data: error.data,
      type: "http",
    };
  }

  return {
    message: error.message,
    type: "unknown",
  };
}