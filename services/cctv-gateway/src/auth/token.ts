import { createHmac, timingSafeEqual } from "node:crypto";

export interface StreamTokenPayload {
  streamId: string;
  cameraId: string;
  /** MediaMTX path the token is scoped to (Phase 4 — enforced by the external auth hook). */
  mediaPath: string;
  exp: number; // Unix timestamp in seconds
}

export function createStreamToken(payload: StreamTokenPayload, secret: string): string {
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(dataB64).digest("base64url");
  return `${dataB64}.${signature}`;
}

export function verifyStreamToken(token: string, secret: string): StreamTokenPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataB64, providedSig] = parts;
  if (!dataB64 || !providedSig) return null;

  const expectedSig = createHmac("sha256", secret).update(dataB64).digest("base64url");

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const rawJson = Buffer.from(dataB64, "base64url").toString("utf8");
    const payload = JSON.parse(rawJson) as StreamTokenPayload;

    if (!payload.streamId || !payload.cameraId || typeof payload.exp !== "number") {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSeconds) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
