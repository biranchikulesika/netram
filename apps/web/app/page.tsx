import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/api";

export default async function HomePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  redirect("/projects");
}
