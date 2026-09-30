import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "../globals.css";
import DisclaimerModal from "./DisclaimerModal";
import { RealtimeProvider } from "./components/realtime-provider";

const NETRAM_TITLE = "Netram — Smart Real-Time Monitoring & Inspection Platform";
const NETRAM_DESCRIPTION =
  "Real-time monitoring and inspection of social welfare institutions. A Smart India Hackathon 2026 project — not an official Government of India platform.";

/**
 * Netram is a Smart India Hackathon 2026 project. It is NOT a Government of
 * India or DoSJE platform, and metadata must never imply that it is — these
 * strings are what crawlers and link previews (Open Graph, Twitter cards,
 * Slack, WhatsApp) show to someone who has never seen the project, which makes
 * them the worst possible place to overstate provenance.
 *
 * The Open Graph block is explicit rather than inherited: without it Next.js
 * emits no og: tags at all, and link-preview scrapers fall back to <title> and
 * <meta name="description"> — which is how the old "official portal" wording
 * reached previews. Next.js derives twitter:* from this block.
 */
export const metadata: Metadata = {
  title: {
    default: NETRAM_TITLE,
    template: "%s · Netram",
  },
  description: NETRAM_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Netram",
    title: NETRAM_TITLE,
    description: NETRAM_DESCRIPTION,
  },
};

/**
 * The web platform is a desktop application. There is no mobile web build —
 * field staff use the separate `apps/inspector-mobile` app — so phone browsers
 * should render the desktop layout rather than a squashed approximation of it.
 *
 * `width: 1280` makes a mobile browser lay the page out at a fixed 1280 CSS
 * pixels and scale the result down to fit, which is exactly the desktop
 * presentation. Next.js's default is `width=device-width`, which is what
 * produced the narrow, unusable layout on a phone.
 *
 * Deliberately NOT set: `userScalable: false`, `maximumScale: 1` or
 * `minimumScale`. Those block pinch-zoom, which is an accessibility
 * requirement — forcing a desktop layout on a small screen is already hard
 * enough to read. Zoom stays available.
 */
export const viewport: Viewport = {
  width: 1280,
  initialScale: 1,
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
