#!/bin/sh
# NETRAM development-only simulated CCTV camera (facility side).
#
# Behaves like a camera: produces a real-time H.264 RTSP stream from the
# repository sample video. The MP4 is NEVER served to a browser — it is only
# the FFmpeg input.
#
# Ingest modes (target architecture Phase 1D). The camera always PUSHES;
# the modes choose the recipient, i.e. where the network boundary sits:
#
#   pull (default, pilot topology):
#     camera -> facility-nvr (inside the facility network) -> [boundary] ->
#     netram-media pulls across the boundary on demand.
#   push (alternative demo):
#     camera pushes straight across the boundary into netram-media.
#
# A burned-in-clock test source is generated at container start when
# CAMERA_SOURCE=clock (Phase 2E latency measurement).

set -eu

MODE="${CAMERA_MODE:-pull}"
CAMERA_PUSH_URI="rtsp://facility-nvr:8554/facility-vani/cam-gate"
MEDIAMTX_PUSH_TARGET="rtsp://netram-media:8554/facility-vani/cam-gate"

if [ "${CAMERA_SOURCE:-}" = "clock" ]; then
  echo "[cam-sim] generating burned-in timestamp test source (latency measurement)"
  CLOCK_FONT="$(find /usr/share/fonts -name 'DejaVuSans.ttf' 2>/dev/null | head -1 || true)"
  mkdir -p /tmp/cam
  # NOTE: the clock is burned ONCE at container start (wall-clock based) and
  # then looped. Latency measurement is valid while the loop position is
  # accounted for — see docs/architecture/cctv-phase-1-2.md.
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=640x360:rate=25" \
    -f lavfi -i "sine=frequency=1000" \
    -vf "drawtext=text='%{localtime\:%X}':fontfile='${CLOCK_FONT}':fontcolor=white:fontsize=32:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-tw)/2:y=h-48,format=yuv420p" \
    -t 30 -c:v libx264 -preset veryfast -crf 26 -c:a aac -shortest \
    /tmp/cam/clock.mp4
  SAMPLE_VIDEO=/tmp/cam/clock.mp4
fi

if [ ! -f "$SAMPLE_VIDEO" ]; then
  echo "[cam-sim] FATAL: sample video not found: $SAMPLE_VIDEO" >&2
  exit 1
fi

echo "[cam-sim] mode=${MODE} source=${SAMPLE_VIDEO}"

case "$MODE" in
  pull)
    echo "[cam-sim] pushing into facility NVR at ${CAMERA_PUSH_URI} (MediaMTX pulls across the boundary)"
    exec ffmpeg -hide_banner -loglevel warning \
      -re -stream_loop -1 -i "$SAMPLE_VIDEO" \
      -c:v libx264 -preset veryfast -crf 26 -g 50 -bf 0 \
      -c:a aac -b:a 96k \
      -f rtsp "$CAMERA_PUSH_URI"
    ;;
  push)
    echo "[cam-sim] pushing straight into netram-media at ${MEDIAMTX_PUSH_TARGET}"
    exec ffmpeg -hide_banner -loglevel warning \
      -re -stream_loop -1 -i "$SAMPLE_VIDEO" \
      -c:v libx264 -preset veryfast -crf 26 -g 50 -bf 0 \
      -c:a aac -b:a 96k \
      -f rtsp "$MEDIAMTX_PUSH_TARGET"
    ;;
  *)
    echo "[cam-sim] FATAL: unknown CAMERA_MODE '${MODE}' (expected pull|push)" >&2
    exit 1
    ;;
esac
