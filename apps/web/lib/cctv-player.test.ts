import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startCctvPlayback, readPlaybackStats } from "./cctv-player";

/**
 * Unit tests for the production WHEP player controller (Phase 5 PART 1/14).
 * WebRTC and fetch are mocked - the tests verify lifecycle semantics
 * (correlation param, Bearer propagation, cleanup, error paths), which is
 * the behavior this module owns.
 */

class FakeRTCPeerConnection {
  static instances: FakeRTCPeerConnection[] = [];

  connectionState = "new";
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  ontrack: ((e: unknown) => void) | null = null;
  listeners = new Map<string, ((e: unknown) => void)[]>();

  addTransceiver = vi.fn();
  addEventListener = vi.fn((type: string, cb: (e: unknown) => void) => {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  });
  removeEventListener = vi.fn();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0 offer" }));
  setLocalDescription = vi.fn(async (d: RTCSessionDescription) => {
    this.localDescription = d;
  });
  setRemoteDescription = vi.fn(async (d: RTCSessionDescription) => {
    this.remoteDescription = d;
  });
  getReceivers = vi.fn(() => []);
  getStats = vi.fn(async () => ({
    forEach: (cb: (s: Record<string, unknown>) => void) => {
      cb({ type: "inbound-rtp", kind: "video", framesDecoded: 42, framesDropped: 1, jitterBufferDelay: 0.05, jitterBufferEmittedCount: 10, bytesReceived: 1234 });
    },
  }));
  close = vi.fn(() => {
    this.connectionState = "closed";
  });

  constructor() {
    FakeRTCPeerConnection.instances.push(this);
  }

  emit(type: string): void {
    for (const cb of this.listeners.get(type) ?? []) cb({ type });
  }
}

const sdpResponse = (status = 201): Response =>
  new Response("v=0 answer", {
    status,
    headers: { "Content-Type": "application/sdp" },
  });

function videoEl(): HTMLVideoElement {
  const el = document.createElement("video");
  document.body.appendChild(el);
  return el;
}

describe("startCctvPlayback (Phase 5 production player)", () => {
  const originalRTC = globalThis.RTCPeerConnection;

  beforeEach(() => {
    FakeRTCPeerConnection.instances = [];
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
      FakeRTCPeerConnection as unknown as typeof RTCPeerConnection;
  });

  afterEach(() => {
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = originalRTC;
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("performs the WHEP handshake through the production proxy with the correlation param", async () => {
    const fetchMock = vi.fn(async () => sdpResponse());
    vi.stubGlobal("fetch", fetchMock);

    const session = await startCctvPlayback(videoEl(), {
      mediaPath: "facility-vani/cam-gate",
      token: "tok-1",
      netramSession: "sess-42",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/cctv/media/whep?path=facility-vani%2Fcam-gate&netramSession=sess-42");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/sdp");
    expect(init.body).toBe("v=0 offer");
    expect(session.pc).toBeInstanceOf(FakeRTCPeerConnection);
  });

  it("stops idempotently: closes the peer connection and detaches media once", async () => {
    const fetchMock = vi.fn(async () => sdpResponse());
    vi.stubGlobal("fetch", fetchMock);
    const el = videoEl();
    const session = await startCctvPlayback(el, {
      mediaPath: "p/x",
      token: "t",
      netramSession: "s",
    });

    session.stop();
    session.stop();

    expect((session.pc as unknown as FakeRTCPeerConnection).close).toHaveBeenCalledTimes(1);
    expect(el.srcObject).toBeNull();
  });

  it("cleans up the peer connection when the handshake fails with a non-201", async () => {
    const fetchMock = vi.fn(async () => new Response("denied", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startCctvPlayback(videoEl(), { mediaPath: "p/x", token: "bad", netramSession: "s" }),
    ).rejects.toThrow(/HTTP 401/);

    const pc = FakeRTCPeerConnection.instances[0];
    expect(pc?.close).toHaveBeenCalled();
  });

  it("rejects a non-SDP answer and cleans up", async () => {
    const fetchMock = vi.fn(
      async () => new Response("nope", { status: 201, headers: { "Content-Type": "text/plain" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startCctvPlayback(videoEl(), { mediaPath: "p/x", token: "t", netramSession: "s" }),
    ).rejects.toThrow(/unexpected content type/);
    expect(FakeRTCPeerConnection.instances[0]!.close).toHaveBeenCalled();
  });

  it("surfaces terminal connection states via onEnded", async () => {
    const fetchMock = vi.fn(async () => sdpResponse());
    vi.stubGlobal("fetch", fetchMock);
    const onEnded = vi.fn();
    const session = await startCctvPlayback(videoEl(), {
      mediaPath: "p/x",
      token: "t",
      netramSession: "s",
      onEnded,
    });

    const pc = session.pc as unknown as FakeRTCPeerConnection;
    pc.connectionState = "failed";
    pc.emit("connectionstatechange");
    expect(onEnded).toHaveBeenCalledWith("failed");
  });
});

describe("readPlaybackStats", () => {
  it("aggregates inbound video stats", async () => {
    const fakePc = {
      getStats: async () => ({
        forEach: (cb: (s: Record<string, unknown>) => void) => {
          cb({ type: "inbound-rtp", kind: "video", framesDecoded: 10, framesDropped: 2, jitterBufferDelay: 0.1, jitterBufferEmittedCount: 4, bytesReceived: 5000 });
        },
      }),
    } as unknown as RTCPeerConnection;

    const stats = await readPlaybackStats(fakePc);
    expect(stats.framesDecoded).toBe(10);
    expect(stats.framesDropped).toBe(2);
    expect(stats.jitterBufferMs).toBe(25);
    expect(stats.bytesReceived).toBe(5000);
  });
});
