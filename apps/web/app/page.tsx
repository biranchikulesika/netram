import { getSessionUser } from "../lib/api";
import { redirect } from "next/navigation";
import Landing from "./components/landing";

// Title and description are inherited from the root layout on purpose. This
// page is what a crawler or link preview sees (unauthenticated, it does not
// redirect), so its provenance should have exactly one definition to drift
// from - see app/layout.tsx.

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");

  return <Landing />;
}
