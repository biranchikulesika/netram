import type { AuthenticatedUser } from "@netram/types";

/**
 * Token supplier. Web passes cookies-based server tokens; mobile passes a
 * bearer token obtained from login. The client never decides authentication —
 * it only transports whatever the host environment provides.
 */
export type TokenSupplier = () => string | null | Promise<string | null>;

/** Standard Netram API error shape (see AGENTS.md §18). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown> | null;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.error.code;
    this.requestId = body.error.requestId;
  }
}

export interface HttpOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getToken?: TokenSupplier;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly getToken?: TokenSupplier;

  constructor(opts: HttpOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    const rawFetch = opts.fetchImpl ?? globalThis.fetch;
    this.fetch = (...args: Parameters<typeof fetch>) => rawFetch(...args);
    this.getToken = opts.getToken;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken ? await this.getToken() : null;
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const headers: Record<string, string> = { accept: "application/json" };
    if (!isForm) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });

    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const errBody =
        payload && typeof payload === "object" && "error" in payload
          ? (payload as ApiErrorBody)
          : null;
      if (errBody) throw new ApiError(res.status, errBody);
      throw new ApiError(res.status, {
        error: {
          code: "unknown",
          message: `Request failed with status ${res.status}`,
        },
      });
    }
    return payload as T;
  }

  /** Fetch a binary resource (e.g. evidence content) with the same auth transport. */
  async getBlob(path: string): Promise<Blob> {
    const token = this.getToken ? await this.getToken() : null;
    const headers: Record<string, string> = { accept: "*/*" };
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as unknown;
      const body =
        errBody && typeof errBody === "object" && "error" in errBody
          ? (errBody as ApiErrorBody)
          : null;
      if (body) throw new ApiError(res.status, body);
      throw new ApiError(res.status, {
        error: {
          code: "unknown",
          message: `Request failed with status ${res.status}`,
        },
      });
    }
    return res.blob();
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

export interface MeResult {
  user: AuthenticatedUser;
  permissions: string[];
}
