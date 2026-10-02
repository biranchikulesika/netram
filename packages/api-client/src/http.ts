import type { AuthenticatedUser } from "@netram/types";

/**
 * Token supplier. Web passes cookies-based server tokens; mobile passes a
 * bearer token obtained from login. The client never decides authentication -
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
  /**
   * Invoked whenever the server rejects the transport token (HTTP 401).
   *
   * An expired token must not be indistinguishable from "no data": callers
   * that swallow a 401 end up rendering an empty list for a signed-in user.
   * The host owns the session, so it decides what to do (clear the session and
   * return to login). Invoked for any 401, on every endpoint.
   */
  onUnauthorized?: () => void;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly getToken?: TokenSupplier;
  private readonly onUnauthorized?: () => void;

  constructor(opts: HttpOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    const rawFetch = opts.fetchImpl ?? globalThis.fetch;
    this.fetch = (...args: Parameters<typeof fetch>) => rawFetch(...args);
    this.getToken = opts.getToken;
    this.onUnauthorized = opts.onUnauthorized;
  }

  private toApiError(res: Response, payload: unknown): ApiError {
    const errBody =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as ApiErrorBody)
        : null;
    const err = errBody
      ? new ApiError(res.status, errBody)
      : new ApiError(res.status, {
          error: {
            code: "unknown",
            message: `Request failed with status ${res.status}`,
          },
        });
    if (res.status === 401) {
      // Never let an auth rejection pass silently: surface it to the host so a
      // stale session cannot masquerade as an empty result.
      try {
        this.onUnauthorized?.();
      } catch {
        // A failing handler must not mask the 401 itself.
      }
    }
    return err;
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
      throw this.toApiError(res, payload);
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
      throw this.toApiError(res, errBody);
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

  delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
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
