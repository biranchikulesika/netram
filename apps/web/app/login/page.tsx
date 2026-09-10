import { redirect } from "next/navigation";
import { loadClientEnv } from "@netram/config";
import { getSessionUser } from "../../lib/api";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/projects");
  const env = loadClientEnv();
  return (
    <main style={{ display: "flex", justifyContent: "center" }}>
      <div>
        <h1>Netram</h1>
        <LoginForm apiUrl={env.NEXT_PUBLIC_API_URL} />
      </div>
    </main>
  );
}
