import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "../globals.css";
import DisclaimerModal from "./DisclaimerModal";
import { RealtimeProvider } from "./components/realtime-provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8fc",
};

const SITE_TITLE =
  "Smart Real-Time Monitoring & Inspection Mobile App | Smart India Hackathon 2026";
const SITE_DESCRIPTION =
  "Centralised platform for live CCTV surveillance, AI-driven surprise inspections, geo-tagged evidence capture, and real-time compliance under DoSJE schemes.";
const SITE_URL = "https://netram.vercel.app";
const OG_IMAGE_VERSION = "1790854004253";
const OG_IMAGE_ALT =
  "Netram: Smart Real-Time Monitoring & Inspection Mobile App (SIH26095, Smart India Hackathon 2026)";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Netram",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Netram | Smart India Hackathon 2026",
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "FAiLohhwVyBZ9GvJcF9wLqoPHs0h1K3Tu8sT5NhDBVg",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Netram | Smart India Hackathon 2026",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
    images: [
      {
        url: `${SITE_URL}/opengraph-image?v=${OG_IMAGE_VERSION}`,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: "@BKulesika",
    creator: "@BKulesika",
    images: [
      {
        url: `${SITE_URL}/twitter-image?v=${OG_IMAGE_VERSION}`,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* RealtimeProvider is a client-only component; it does not render
            during server-side prerendering of error pages. */}
        <RealtimeProvider />
        <DisclaimerModal />
        {children}
      </body>
    </html>
  );
}
