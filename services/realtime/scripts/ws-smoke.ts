import WebSocket from "ws";

const TOKEN = process.argv[2]!;
const API = "http://localhost:3101";
const WS_URL = "ws://localhost:3102/?token=" + TOKEN + "&topics=project.*";

async function main() {
  const ws = new WebSocket(WS_URL);
  let authorized = false;
  ws.on("message", async (m: WebSocket.RawData) => {
    const msg = JSON.parse(m.toString());
    console.log("MSG:", msg.event, JSON.stringify(msg.data).slice(0, 160));
    if (msg.event === "netram.authorized") {
      authorized = true;
      const r = await fetch(`${API}/api/v1/projects`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Realtime Test Hostel" }),
      });
      console.log("create status:", r.status);
    }
    if (msg.event === "netram.event") {
      console.log("CIRCUIT OK: outbox -> poller -> hub -> ws");
      ws.close();
      process.exit(0);
    }
  });
  ws.on("open", () => console.log("ws open"));
  ws.on("close", (c, r) => {
    console.log("closed:", c, r.toString());
    process.exit(0);
  });
  setTimeout(() => {
    console.log("TIMEOUT");
    process.exit(1);
  }, 15000);
}

void main();
