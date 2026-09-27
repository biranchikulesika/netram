import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "../globals.css";
import DisclaimerModal from "./DisclaimerModal";
import { RealtimeProvider } from "./components/realtime-provider";

export const metadata: Metadata = {
  title: "Netram",
  description: "Smart real-time monitoring & inspection platform for DoSJE",
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
