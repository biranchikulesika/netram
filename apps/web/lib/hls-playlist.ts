/**
 * HLS playlist rewriting for the same-origin authorized HLS proxy
 * (apps/web/app/api/cctv/media/hls - Phase 5 wall mode).
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
 *
 * `basePath` is the media path the playlist itself was served from
 * ("facility-vani/cam-gate"). MediaMTX emits child URIs RELATIVE
 * ("video1_stream.m3u8"), which HLS resolves against the containing
 * playlist's directory. Dropping that directory would proxy the child to
 * the media root, where the auth hook denies it (path_mismatch) and the
 * player reports playback failure. Absolute upstream URIs already carry
 * their full path and are used as-is.
 */
export function rewritePlaylist(body: string, token: string, basePath = ""): string {
  const dir = basePath.replace(/^\/+|\/+$/g, "");

  const rewriteUri = (raw: string): string => {
    const trimmed = raw.trim();
    // Keep only the path portion if MediaMTX ever emits an absolute URL.
    let p = trimmed;
    let absolute = false;
    try {
      const url = new URL(trimmed);
      p = url.pathname + url.search;
      absolute = true;
    } catch {
      /* relative URI - resolve against the playlist's own directory */
    }
    const q = p.indexOf("?");
    let file = q === -1 ? p : p.slice(0, q);
    const search = q === -1 ? "" : p.slice(q + 1);
    file = file.replace(/^\/+/, "");
    if (!absolute && dir.length > 0) {
      file = `${dir}/${file}`;
    }
    const base = `${HLS_PROXY_PREFIX}/${file}`;
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
    .map(dropAudioRendition)
    .join("\n");
}

/**
 * Wall tiles are muted monitoring thumbnails, so the audio rendition is dead
 * weight: it doubles the playlist reload rate (hls.js refreshes the audio
 * level alongside the video one) and adds a second SourceBuffer plus an AAC
 * decoder per tile. Dropping the AUDIO group leaves a valid video-only
 * master, and nothing plays HLS audio anyway - the interactive live view is
 * WebRTC. The interactive viewer's own stream is untouched by this.
 */
function dropAudioRendition(line: string): string {
  if (line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=AUDIO")) return "";
  if (!line.startsWith("#EXT-X-STREAM-INF:")) return line;
  return line.replace(/,?AUDIO="[^"]*"/, "").replace(/CODECS="([^"]*)"/, (_m, codecs: string) => {
    const video = codecs
      .split(",")
      .filter((c) => !c.trim().startsWith("mp4a"))
      .join(",");
    return video.length > 0 ? `CODECS="${video}"` : "";
  });
}
