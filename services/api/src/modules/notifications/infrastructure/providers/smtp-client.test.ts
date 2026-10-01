import { createServer, type AddressInfo, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { EmailNotificationProvider } from "./email.provider.js";
import { parseSmtpUrl, SmtpClient } from "./smtp-client.js";

interface FakeSmtpServer {
  port: number;
  commands: string[];
  messages: string[];
  close: () => Promise<void>;
}

/** Minimal in-process SMTP server that records the client's commands. */
async function startFakeSmtpServer(): Promise<FakeSmtpServer> {
  const commands: string[] = [];
  const messages: string[] = [];
  const server = createServer((socket: Socket) => {
    let buffer = "";
    let inData = false;
    let message = "";
    socket.write("220 fake.test ESMTP ready\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (inData) {
          if (line === ".") {
            inData = false;
            messages.push(message);
            message = "";
            socket.write("250 2.0.0 Ok: queued as fake\r\n");
          } else {
            message += (message ? "\n" : "") + line;
          }
          continue;
        }
        commands.push(line);
        const verb = line.split(" ")[0]?.toUpperCase();
        switch (verb) {
          case "EHLO":
            socket.write("250-fake.test\r\n250-8BITMIME\r\n250 SIZE 10485760\r\n");
            break;
          case "MAIL":
            socket.write("250 2.1.0 Ok\r\n");
            break;
          case "RCPT":
            socket.write("250 2.1.5 Ok\r\n");
            break;
          case "DATA":
            inData = true;
            socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
            break;
          case "QUIT":
            socket.write("221 2.0.0 Bye\r\n");
            socket.end();
            break;
          default:
            socket.write("250 Ok\r\n");
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    commands,
    messages,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

const openServers: FakeSmtpServer[] = [];
afterEach(async () => {
  await Promise.all(openServers.splice(0).map((s) => s.close()));
});

describe("SmtpClient", () => {
  it("sends a message through the RFC 5321 command sequence", async () => {
    const server = await startFakeSmtpServer();
    openServers.push(server);

    const client = new SmtpClient({
      host: "127.0.0.1",
      port: server.port,
      from: "noreply@netram.in",
    });
    await client.send({
      to: "inspector@example.org",
      from: "noreply@netram.in",
      subject: "New Inspection Assigned",
      text: "You have a new inspection.\n.leading-dot line",
    });

    expect(server.commands[0]?.startsWith("EHLO ")).toBe(true);
    expect(server.commands).toContain("MAIL FROM:<noreply@netram.in>");
    expect(server.commands).toContain("RCPT TO:<inspector@example.org>");
    expect(server.commands).toContain("DATA");
    expect(server.commands).toContain("QUIT");
    expect(server.commands.some((c) => c.startsWith("STARTTLS"))).toBe(false);

    const message = server.messages[0];
    expect(message).toContain("Subject: New Inspection Assigned");
    expect(message).toContain("You have a new inspection.");
    expect(message).toContain("..leading-dot line"); // dot-stuffing
  });
});

describe("EmailNotificationProvider", () => {
  it("delivers over SMTP when a recipient address is provided", async () => {
    const server = await startFakeSmtpServer();
    openServers.push(server);

    const provider = new EmailNotificationProvider({
      host: "127.0.0.1",
      port: server.port,
      from: "noreply@netram.in",
    });
    const result = await provider.send({
      notificationId: "notif-1",
      userId: "user-1",
      type: "inspection.assigned",
      title: "Overdue Alert",
      body: "Action is overdue.",
      channel: "email",
      meta: { to: "authority@example.org" },
    });

    expect(result.delivered).toBe(true);
    expect(result.provider).toBe("smtp");
    expect(server.messages[0]).toContain("To: authority@example.org");
  });

  it("returns a traceable non-delivery without a recipient address", async () => {
    const provider = new EmailNotificationProvider({
      host: "127.0.0.1",
      port: 1,
      from: "noreply@netram.in",
    });
    const result = await provider.send({
      notificationId: "notif-2",
      userId: "user-2",
      type: "inspection.assigned",
      title: "No recipient",
      channel: "email",
    });
    expect(result.delivered).toBe(false);
    expect(result.reason).toContain("no recipient");
  });
});

describe("parseSmtpUrl", () => {
  it("parses a plain smtp:// URL with explicit port", () => {
    expect(parseSmtpUrl("smtp://localhost:1025", "noreply@netram.in")).toEqual({
      host: "localhost",
      port: 1025,
      secure: false,
      from: "noreply@netram.in",
    });
  });

  it("parses smtps:// with credentials and default port 465", () => {
    expect(parseSmtpUrl("smtps://user:secret@mail.example.com", "noreply@netram.in")).toEqual({
      host: "mail.example.com",
      port: 465,
      secure: true,
      username: "user",
      password: "secret",
      from: "noreply@netram.in",
    });
  });

  it("rejects unsupported schemes", () => {
    expect(() => parseSmtpUrl("http://localhost:1025", "noreply@netram.in")).toThrow(
      /Unsupported SMTP URL scheme/,
    );
  });
});
