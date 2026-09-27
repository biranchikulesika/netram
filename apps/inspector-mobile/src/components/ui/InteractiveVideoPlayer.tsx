import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";
import { Icon } from "./Icon";
import { colors } from "../../theme/colors";

export interface InteractiveVideoPlayerProps {
  src: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  watermarkText?: string;
}

function WebVideo({
  src,
  autoPlay,
}: {
  src: string;
  autoPlay?: boolean;
}) {
  return React.createElement("video", {
    src,
    controls: true,
    playsInline: true,
    autoPlay: Boolean(autoPlay),
    preload: "auto",
    style: {
      width: "100%",
      height: "100%",
      backgroundColor: "#000000",
      objectFit: "contain",
      borderRadius: 8,
      outline: "none",
      display: "block",
    },
  });
}

function NativeExpoVideo({
  src,
  autoPlay,
  style,
}: {
  src: string;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
    p.muted = false;
    if (autoPlay) {
      p.play();
    }
  });

  return (
    <VideoView
      player={player}
      style={[styles.fullSize, style]}
      nativeControls={true}
      allowsFullscreen={true}
      contentFit="contain"
      showsTimecodes={true}
    />
  );
}

function NativeWebViewFallback({
  src,
  autoPlay,
}: {
  src: string;
  autoPlay?: boolean;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #000000; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          video { width: 100%; height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <video src="${src}" controls playsinline ${autoPlay ? "autoplay" : ""} preload="auto"></video>
      </body>
    </html>
  `;

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      allowFileAccess={true}
      allowFileAccessFromFileURLs={true}
      allowUniversalAccessFromFileURLs={true}
      domStorageEnabled={true}
      style={styles.fullSize}
    />
  );
}

export function InteractiveVideoPlayer({
  src,
  style,
  autoPlay = false,
}: InteractiveVideoPlayerProps) {
  const flattened = StyleSheet.flatten(style);
  const containerHeight = flattened?.height || 220;

  if (!src) {
    return (
      <View style={[styles.container, { height: containerHeight }, style, styles.emptyBox]}>
        <Icon name="videocam" size={36} color={colors.textMuted} />
        <Text style={styles.emptyText}>No Video Source</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: containerHeight }, style]}>
      {Platform.OS === "web" ? (
        <WebVideo src={src} autoPlay={autoPlay} />
      ) : (
        <NativePlayerContainer src={src} autoPlay={autoPlay} />
      )}
    </View>
  );
}

class NativePlayerContainer extends React.Component<{
  src: string;
  autoPlay?: boolean;
}> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return <NativeWebViewFallback src={this.props.src} autoPlay={this.props.autoPlay} />;
    }
    return <NativeExpoVideo src={this.props.src} autoPlay={this.props.autoPlay} />;
  }
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#000000",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  fullSize: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});
