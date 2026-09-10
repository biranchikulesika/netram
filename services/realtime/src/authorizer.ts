/**
 * Authorizes a realtime subscription against the authoritative API. The
 * realtime service never decides authorization itself.
 */
export class ApiAuthorizer {
  constructor(private readonly apiBaseUrl: string) {}

  async authorizeTopics(token: string, topics: string[]): Promise<string[]> {
    const res = await fetch(`${this.apiBaseUrl}/api/v1/realtime/authorize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ topics }),
    });
    if (!res.ok) {
      throw new Error(`Realtime authorization denied (HTTP ${res.status})`);
    }
    const body = (await res.json()) as { allowedTopics?: string[] };
    return body.allowedTopics ?? [];
  }
}
