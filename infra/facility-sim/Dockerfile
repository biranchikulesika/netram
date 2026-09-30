# NETRAM development-only simulated facility camera.
#
# Provides FFmpeg for the camera simulator (see entrypoint.sh): real-time
# H.264 RTSP serving (pull mode) or pushing (push mode). Dev-only image -
# never deployed outside the `facility` compose profile.
FROM docker.io/library/alpine:3.20

# ffmpeg: the "camera"; tini: forward signals so `docker stop` terminates
# ffmpeg promptly; font-dejavu: burned-in clock for the latency test source.
RUN apk add --no-cache ffmpeg font-dejavu tini

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
