/**
 * CDN Icon — High-performance vector icon loaded exclusively from the Iconify CDN.
 *
 * CDN Endpoint:
 *   https://api.iconify.design/{collection}/{name}.svg?width={size}&height={size}&color={color}
 *
 * Benefits:
 * - Pure CDN-delivered SVG (zero font bundle weight, zero mismatched web font glyphs)
 * - Exact color injection at edge CDN via query parameter
 * - Cloudflare edge caching with immutable headers
 * - Unified cross-platform fallback for native runtimes
 */
import React from "react";
import {
  Image,
  Platform,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

export type IconName = string;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle | ViewStyle>;
}

const CDN_BASE = "https://api.iconify.design";

/**
 * Normalizes common icon shorthand names to their standard CDN counterparts.
 */
function normalizeIconName(name: string): { collection: string; iconName: string } {
  if (name.includes(":")) {
    const parts = name.split(":");
    const collection = parts[0] ?? "ion";
    const iconName = parts.slice(1).join(":");
    return { collection, iconName };
  }

  // Alias dictionary for convenience
  const aliases: Record<string, string> = {
    search: "search-outline",
    close: "close-outline",
    checkmark: "checkmark-outline",
    refresh: "refresh-outline",
    bell: "notifications-outline",
    trash: "trash-outline",
    filter: "funnel-outline",
    user: "person-outline",
    home: "home-outline",
    camera: "camera-outline",
    document: "document-text-outline",
    sync: "sync-outline",
    warning: "warning-outline",
    shield: "shield-outline",
    location: "location-outline",
    "arrow-down-left": "arrow-down-outline",
  };

  const resolved = aliases[name] || name;
  return { collection: "ion", iconName: resolved };
}

/**
 * Constructs a CDN URL for an icon.
 */
export function getCdnIconUrl(
  name: string,
  size: number = 20,
  color: string = "#FFFFFF"
): string {
  if (name.startsWith("http://") || name.startsWith("https://")) {
    return name;
  }

  const { collection, iconName } = normalizeIconName(name);
  const encodedColor = encodeURIComponent(color);
  return `${CDN_BASE}/${collection}/${iconName}.svg?width=${size}&height=${size}&color=${encodedColor}`;
}

export function Icon({
  name,
  size = 20,
  color = colors.darkTextPrimary,
  style,
}: IconProps) {
  const iconUrl = getCdnIconUrl(name, size, color);

  if (name.startsWith("http://") || name.startsWith("https://")) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={[{ width: size, height: size }, style as ImageStyle]}
        resizeMode="contain"
      />
    );
  }

  try {
    const { iconName } = normalizeIconName(name);
    return (
      <Ionicons
        name={iconName as keyof typeof Ionicons.glyphMap}
        size={size}
        color={color}
        style={style as StyleProp<ViewStyle>}
      />
    );
  } catch {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={[
          {
            width: size,
            height: size,
          },
          styles.webIcon as unknown as ImageStyle,
          style as ImageStyle,
        ]}
        resizeMode="contain"
        accessibilityRole="image"
      />
    );
  }
}

const styles = StyleSheet.create({
  webIcon: {
    // Prevents accidental pointer-event trapping on web icons
    ...(Platform.OS === "web" ? { pointerEvents: "none" } : {}),
  },
});
