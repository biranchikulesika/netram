import { describe, expect, it } from "vitest";
import { rewritePlaylist } from "./hls-playlist";

const TOKEN = "tok-abc123";

describe("rewritePlaylist (Phase 5 HLS wall mode)", () => {
  it("rewrites master playlist variant URIs to same-origin proxy URLs with the viewer token", () => {
    const master = [
      "#EXTM3U",
      "#EXT-X-VERSION:10",
      "#EXT-X-INDEPENDENT-SEGMENTS",
      "",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="audio2",AUTOSELECT=YES,DEFAULT=YES,URI="audio2_stream.m3u8?session=s1&token=oldtok"',
      "",
      '#EXT-X-STREAM-INF:BANDWIDTH=1034795,CODECS="avc1.64001f",RESOLUTION=848x474,AUDIO="audio"',
      "video1_stream.m3u8?session=s1&token=oldtok",
    ].join("\n");

    const out = rewritePlaylist(master, TOKEN, "facility-vani/cam-gate");
    expect(out).toContain("/api/cctv/media/hls/facility-vani/cam-gate/video1_stream.m3u8?");
    expect(out).toContain(`token=${TOKEN}`);
    expect(out).not.toContain("oldtok");
  });

  // Wall tiles are muted, so the audio rendition is stripped: it would double
  // the playlist reload rate and add a SourceBuffer + AAC decoder per tile.
  it("drops the audio rendition so muted wall tiles fetch video only", () => {
    const master = [
      "#EXTM3U",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="audio2",DEFAULT=YES,URI="audio2_stream.m3u8?session=s1"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1139858,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=848x474,FRAME-RATE=29.970,AUDIO="audio"',
      "video1_stream.m3u8?session=s1",
    ].join("\n");

    const out = rewritePlaylist(master, TOKEN, "facility-vani/cam-gate");
    expect(out).not.toContain("audio2_stream.m3u8");
    expect(out).not.toContain("TYPE=AUDIO");
    expect(out).not.toContain("AUDIO=");
    expect(out).not.toContain("mp4a");
    // The video rendition itself must survive intact.
    expect(out).toContain('CODECS="avc1.64001f"');
    expect(out).toContain("RESOLUTION=848x474");
    expect(out).toContain("video1_stream.m3u8?");
  });

  // Regression: relative child URIs must keep the media path, or the proxy
  // requests them from the media root, the auth hook denies with
  // path_mismatch (401), and the player reports "HLS playback failed".
  it("keeps the media path on relative child URIs (path_mismatch regression)", () => {
    const out = rewritePlaylist("video1_stream.m3u8?session=s1", TOKEN, "facility-vani/cam-gate");
    expect(out).toBe(
      `/api/cctv/media/hls/facility-vani/cam-gate/video1_stream.m3u8?session=s1&token=${TOKEN}`,
    );
    expect(out).not.toBe(`/api/cctv/media/hls/video1_stream.m3u8?session=s1&token=${TOKEN}`);
  });

  it("resolves relative segment URIs in a variant playlist against its media path", () => {
    const variant = [
      '#EXT-X-MAP:URI="abc_video1_init.mp4?session=s2&token=oldtok"',
      "#EXTINF:1.66833,",
      "abc_video1_seg45.mp4?session=s2&token=oldtok",
      "gap.mp4",
    ].join("\n");

    const out = rewritePlaylist(variant, TOKEN, "facility-vani/cam-gate");
    expect(out).toContain(
      `/api/cctv/media/hls/facility-vani/cam-gate/abc_video1_init.mp4?session=s2&token=${TOKEN}`,
    );
    expect(out).toContain(
      `/api/cctv/media/hls/facility-vani/cam-gate/abc_video1_seg45.mp4?session=s2&token=${TOKEN}`,
    );
    expect(out).toContain(`/api/cctv/media/hls/facility-vani/cam-gate/gap.mp4?token=${TOKEN}`);
  });

  it("rewrites #EXT-X-MAP init URIs and segment lines in variant playlists", () => {
    const variant = [
      "#EXTM3U",
      "#EXT-X-TARGETDURATION:2",
      '#EXT-X-MAP:URI="abc_video1_init.mp4?session=s2&token=oldtok"',
      "#EXTINF:1.66833,",
      "abc_video1_seg45.mp4?session=s2&token=oldtok",
      "gap.mp4",
    ].join("\n");

    const out = rewritePlaylist(variant, TOKEN);
    expect(out).toContain(
      '/api/cctv/media/hls/abc_video1_init.mp4?session=s2&token=tok-abc123',
    );
    expect(out).toContain("/api/cctv/media/hls/abc_video1_seg45.mp4?session=s2&token=tok-abc123");
    expect(out).toContain("/api/cctv/media/hls/gap.mp4?token=tok-abc123");
    expect(out).not.toContain("oldtok");
  });

  it("replaces any pre-existing token so playlist URLs cannot outlive the viewer session", () => {
    const variant = "abc_seg1.mp4?session=s3&token=STALE";
    const out = rewritePlaylist(variant, TOKEN);
    expect(out).toBe(`/api/cctv/media/hls/abc_seg1.mp4?session=s3&token=${TOKEN}`);
    expect(out).not.toContain("STALE");
  });

  it("handles absolute upstream URIs by keeping only the path", () => {
    const line = "http://mediamtx.internal:8888/facility-vani/cam-gate/abc_seg1.mp4?token=oldtok";
    const out = rewritePlaylist(line, TOKEN);
    expect(out).toBe(`/api/cctv/media/hls/facility-vani/cam-gate/abc_seg1.mp4?token=${TOKEN}`);
  });

  it("leaves comments and blank lines untouched", () => {
    const body = "#EXTM3U\n\n# a comment line\nabc_seg1.mp4\n";
    const out = rewritePlaylist(body, TOKEN);
    expect(out.split("\n")[0]).toBe("#EXTM3U");
    expect(out.split("\n")[1]).toBe("");
    expect(out.split("\n")[2]).toBe("# a comment line");
  });
});
