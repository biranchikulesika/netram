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

    const out = rewritePlaylist(master, TOKEN);
    expect(out).toContain("audio2_stream.m3u8");
    expect(out).toContain("/api/cctv/media/hls/video1_stream.m3u8?");
    expect(out).toContain(`token=${TOKEN}`);
    expect(out).not.toContain("oldtok");
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
