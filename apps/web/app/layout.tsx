import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "../globals.css";
import DisclaimerModal from "./DisclaimerModal";
import { RealtimeProvider } from "./components/realtime-provider";

const NETRAM_TITLE = "Netram - Smart Real-Time Monitoring & Inspection Platform";
const NETRAM_DESCRIPTION =
  "Real-time monitoring and inspection of social welfare institutions. A Smart India Hackathon 2026 project - not an official Government of India platform.";

/**
 * Netram is a Smart India Hackathon 2026 project. It is NOT a Government of
 * India or DoSJE platform, and metadata must never imply that it is - these
 * strings are what crawlers and link previews (Open Graph, Twitter cards,
 * Slack, WhatsApp) show to someone who has never seen the project, which makes
 * them the worst possible place to overstate provenance.
 *
 * The Open Graph block is explicit rather than inherited: without it Next.js
 * emits no og: tags at all, and link-preview scrapers fall back to <title> and
 * <meta name="description"> - which is how the old "official portal" wording
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
