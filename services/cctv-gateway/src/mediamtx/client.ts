/**
 * MediaMTX control client (Phase 3) - the gateway's ONLY way to talk to the
 * media server. Encapsulates every MediaMTX REST operation so no other module
 * imports MediaMTX URLs or credentials.
 *
 * Endpoint behavior verified live against MediaMTX v1.21.1 (OSS edition):
 *   GET  /v3/paths/list                     → { itemCount, items: PathState[] }
 *   GET  /v3/paths/get/{name}               → PathState | 404 "path not found"
 *   POST /v3/config/paths/add/{name}        → 200 ok | 400 "path already exists"
 *   POST /v3/webrtcsessions/kick/{uuid}     → 200 | 404 "session not found"
 *   POST /v3/rtspsessions/kick/{uuid}       → 200 | 404 "session not found"
 *   GET  /v3/webrtcsessions/list            → { itemCount, items: [...] }
 *  (v3/config/paths/set|remove/{name} do NOT exist in the OSS edition -
 *   provisioning is add-only; see ensurePath for idempotency handling.)
 *
 * All requests are bounded by timeouts; failures surface as MediamtxError so
 * the control plane never hangs on a dead media server.
 */

export interface MediamtxPathSource {
  type: string;
  id: string;
}

export interface MediamtxPathReader {
  type: string;
  id: string;
}

/** Subset of MediaMTX's path state the control plane needs (live-verified shape). */
export interface MediamtxPathState {
  name: string;
  confName: string | null;
  /** True when a source is connected and producing (stream ready). */
  ready: boolean;
  readyTime: string | null;
  /** True when the path exists and can accept readers (incl. on-demand pending). */
  available: boolean;
  availableTime: string | null;
  online: boolean;
  source: MediamtxPathSource | null;
  tracks: string[];
  readers: MediamtxPathReader[];
  bytesReceived?: number;
  bytesSent?: number;
  inboundBytes?: number;
  outboundBytes?: number;
}

export interface MediamtxSessionSummary {
  id: string;
  created?: string;
  state?: string;
  path?: string;
  [key: string]: unknown;
}

export class MediamtxError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | undefined,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "MediamtxError";
  }
}

export interface MediamtxClientOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

interface EnvelopeOk<T> {
  itemCount?: number;
  pageCount?: number;
  items?: T[];
}

interface EnvelopeError {
  status: "error";
  error: string;
}

function isEnvelopeError(body: unknown): body is EnvelopeError {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as EnvelopeError).status === "error" &&
    typeof (body as EnvelopeError).error === "string"
  );
}

export class MediamtxClient {
  private readonly baseUrl: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: MediamtxClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.username = options.username;
    this.password = options.password;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.username !== undefined && this.password !== undefined) {
      const basic = Buffer.from(`${this.username}:${this.password}`).toString("base64");
      headers.Authorization = `Basic ${basic}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new MediamtxError(
        "MediaMTX control API unreachable",
        undefined,
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const parsed: unknown = await res.json();
        if (isEnvelopeError(parsed)) detail = parsed.error;
      } catch {
        // non-JSON error body - keep the HTTP status detail
      }
      throw new MediamtxError(`MediaMTX request failed: ${detail}`, res.status, detail);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** List all configured+running paths with their state. */
  async listPaths(): Promise<MediamtxPathState[]> {
    const body = await this.request<EnvelopeOk<MediamtxPathState>>("GET", "/v3/paths/list");
    return body.items ?? [];
  }

  /** Get one path's state; null when the path does not exist. */
  async getPath(name: string): Promise<MediamtxPathState | null> {
    try {
      return await this.request<MediamtxPathState>(
        "GET",
        `/v3/paths/get/${encodeURIComponent(name)}`,
      );
    } catch (err) {
      if (err instanceof MediamtxError && err.statusCode === 404) return null;
      throw err;
    }
  }

  /**
   * Ensure a path exists with the given ingest source configuration.
   *
   * Idempotent: if the path already exists this succeeds without touching it
   * (MediaMTX OSS has no config/paths/set route - see module doc). Use
   * replacePathSource when a source change is genuinely required.
   */
  async ensurePath(
    name: string,
    config: {
      source: string;
      sourceOnDemand?: boolean;
      sourceOnDemandStartTimeout?: string;
      sourceOnDemandCloseAfter?: string;
    },
  ): Promise<{ created: boolean }> {
    const payload: Record<string, unknown> = {
      source: config.source,
      sourceOnDemand: config.sourceOnDemand ?? true,
    };
    if (config.sourceOnDemandStartTimeout !== undefined) {
      payload.sourceOnDemandStartTimeout = config.sourceOnDemandStartTimeout;
    }
    if (config.sourceOnDemandCloseAfter !== undefined) {
      payload.sourceOnDemandCloseAfter = config.sourceOnDemandCloseAfter;
    }

    try {
      await this.request<{ status: string }>(
        "POST",
        `/v3/config/paths/add/${encodeURIComponent(name)}`,
        payload,
      );
      return { created: true };
    } catch (err) {
      // v1.21.1 OSS: duplicate provisioning returns 400 "path already exists".
      if (err instanceof MediamtxError && err.statusCode === 400) {
        return { created: false };
      }
      throw err;
    }
  }

  /** Cheap existence check for a path (token verification, control flow). */
  async pathExists(name: string): Promise<boolean> {
    return (await this.getPath(name)) !== null;
  }

  /**
   * Readers currently attached to a path (fan-out verification, monitoring).
   */
  async getPathStats(name: string): Promise<{
    exists: boolean;
    ready: boolean;
    available: boolean;
    online: boolean;
    readerCount: number;
    readers: MediamtxPathReader[];
    sourceType: string | null;
    bytesSent: number;
  } | null> {
    const path = await this.getPath(name);
    if (!path) return null;
    return {
      exists: true,
      ready: path.ready,
      available: path.available,
      online: path.online,
      readerCount: path.readers.length,
      readers: path.readers,
      sourceType: path.source?.type ?? null,
      bytesSent: path.bytesSent ?? path.outboundBytes ?? 0,
    };
  }

  /**
   * Disconnect WebRTC reader sessions whose WHEP request query carries the
   * given NETRAM session id (Phase 5 correlation).
   *
   * Mechanism (live-verified against MediaMTX v1.21.1): MediaMTX echoes the
   * WHEP request's query string into each WebRTC session record's `query`
   * field, so a reader created with `?…&netramSession=<id>` can be located by
   * listing sessions and matching that field. No invented MediaMTX API.
   * Returns the number of readers actually kicked.
   */
  async kickReadersByNetramSession(netramSessionId: string): Promise<number> {
    const sessions = await this.listWebRtcSessions();
    let kicked = 0;
    for (const session of sessions) {
      const query = typeof session["query"] === "string" ? (session["query"] as string) : "";
      const params = new URLSearchParams(query);
      if (params.get("netramSession") !== netramSessionId) continue;
      if (await this.kickReader(session.id)) kicked += 1;
    }
    return kicked;
  }

  /**
   * Disconnect a WebRTC reader session (control operation; Phase 4 will use
   * this for session lifecycle).
   */
  async kickReader(sessionId: string): Promise<boolean> {
    try {
      await this.request("POST", `/v3/webrtcsessions/kick/${encodeURIComponent(sessionId)}`);
      return true;
    } catch (err) {
      if (err instanceof MediamtxError && err.statusCode === 404) return false;
      throw err;
    }
  }

  /** List active WebRTC (WHEP) reader sessions. */
  async listWebRtcSessions(): Promise<MediamtxSessionSummary[]> {
    const body = await this.request<EnvelopeOk<MediamtxSessionSummary>>(
      "GET",
      "/v3/webrtcsessions/list",
    );
    return body.items ?? [];
  }

  /**
   * Liveness probe of the control API. Cheap and auth-checked; a failure here
   * means the media control plane is unavailable.
   */
  async checkHealth(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.request("GET", "/v3/paths/list");
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}
