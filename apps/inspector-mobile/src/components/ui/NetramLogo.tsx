import React from "react";
import { Image, Platform, StyleSheet, View } from "react-native";

interface NetramLogoProps {
  width?: number;
  height?: number;
}

const SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 48" width="160" height="48" fill="none"><rect x="2" y="6" width="36" height="36" rx="8" fill="#0B2545"/><circle cx="20" cy="24" r="11" stroke="#60A5FA" stroke-width="2" stroke-dasharray="2 2"/><circle cx="20" cy="24" r="6" fill="#10B981"/><path d="M16 24L19 27L25 21" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="46" y="26" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="19" fill="#0B2545" letter-spacing="1.5">NETRAM</text><text x="47" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="7.5" fill="#64748B" letter-spacing="0.5">GOVT. OF INDIA • DoSJE</text></svg>`;

const BASE64_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAgNDgiIHdpZHRoPSIxNjAiIGhlaWdodD0iNDgiIGZpbGw9Im5vbmUiPjxyZWN0IHg9IjIiIHk9IjYiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiMwQjI1NDUiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjI0IiByPSIxMSIgc3Ryb2tlPSIjNjBBNUZBIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1kYXNoYXJyYXk9IjIgMiIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjQiIHI9IjYiIGZpbGw9IiMxMEI5ODEiLz48cGF0aCBkPSJNMTYgMjRMMTkgMjdMMjUgMjEiIHN0cm9rZT0iI0ZGRkZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48dGV4dCB4PSI0NiIgeT0iMjYiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI5MDAiIGZvbnQtc2l6ZT0iMTkiIGZpbGw9IiMwQjI1NDUiIGxldHRlci1zcGFjaW5nPSIxLjUiPk5FVFJBTTwvdGV4dD48dGV4dCB4PSI0NyIgeT0iMzgiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI2MDAiIGZvbnQtc2l6ZT0iNy41IiBmaWxsPSIjNjQ3NDhCIiBsZXR0ZXItc3BhY2luZz0iMC41Ij5HT1ZULiBPRiBJTkRJQSDigKIgRG9TSkU8L3RleHQ+PC9zdmc+";

export function NetramLogo({ width = 160, height = 48 }: NetramLogoProps) {
  if (Platform.OS === "web") {
    return React.createElement("div", {
      dangerouslySetInnerHTML: { __html: SVG_RAW },
      style: {
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={{ uri: BASE64_URI }}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
