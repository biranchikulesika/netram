/**
 * HLS playlist rewriting for the same-origin authorized HLS proxy
 * (apps/web/app/api/cctv/media/hls — Phase 5 wall mode).
 *
 * Live-verified MediaMTX v1.21.1 playlist shape:
 *   index.m3u8 → variant URIs "video1_stream.m3u8?session=<id>&token=<tok>"
 *   variant    → '#EXT-X-MAP:URI="…_init.mp4?session=…&token=…"' + segments
 *   gap filler → "gap.mp4" (no query) while the on-demand source starts
 *
 * Every URI is rewritten to a same-origin proxy URL that carries the
 * VIEWER'S current playback token, so playlist URLs never outlive the
 * session and never leak MediaMTX's host.
 */

export const HLS_PROXY_PREFIX = "/api/cctv/media/hls";

/**
 * Rewrite a playlist body so every URI line is a same-origin proxy URL
 * carrying `token`. Handles plain URI lines and `#EXT-X-MAP:URI="…"`
 * attribute lines; comment/blank lines pass through unchanged.
 */
export function rewritePlaylist(body: string, token: string): string {
  const rewriteUri = (raw: string): string => {
    const trimmed = raw.trim();
    // Keep only the path portion if MediaMTX ever emits an absolute URL.
    let p = trimmed;
    try {
      const url = new URL(trimmed);
      p = url.pathname + url.search;
    } catch {
      /* relative URI — keep as-is */
    }
    const q = p.indexOf("?");
    const file = q === -1 ? p : p.slice(0, q);
    const search = q === -1 ? "" : p.slice(q + 1);
    const base = `${HLS_PROXY_PREFIX}${file.startsWith("/") ? file : `/${file}`}`;
    const params = new URLSearchParams(search);
    params.set("token", token);
    return `${base}?${params.toString()}`;
  };

  return body
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("#")) {
        // Rewrite the URI attribute of any playlist tag that carries one
        // (#EXT-X-MAP, #EXT-X-MEDIA, #EXT-X-I-FRAME-STREAM-INF, …) so stale
        // tokens never survive and audio/media renditions stay proxied.
        const uriIdx = line.indexOf('URI="');
        if (uriIdx !== -1) {
          const start = uriIdx + 5;
          const end = line.indexOf('"', start);
          if (end !== -1) {
            return `${line.slice(0, start)}${rewriteUri(line.slice(start, end))}${line.slice(end)}`;
          }
        }
        return line;
      }
      if (line.trim().length === 0) return line;
      return rewriteUri(line);
    })
    .join("\n");
}
