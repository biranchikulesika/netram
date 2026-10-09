import type { Metadata } from "next";
import Landing from "../components/landing";
import DemoVideoModal from "./DemoVideoModal";

export const metadata: Metadata = {
  title: "Netram Demo",
  description: "Watch the Netram demonstration video, then explore the platform.",
};

export default function DemoVideoPage() {
  return (
    <>
      <Landing />
      <DemoVideoModal />
    </>
  );
}
