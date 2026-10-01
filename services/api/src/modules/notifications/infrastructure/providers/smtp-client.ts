import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";

/**
 * Minimal RFC 5321 SMTP client using only Node built-ins (no vendor/library
 * coupling). Supports plain smtp://, implicit-TLS smtps://, opportunistic
 * STARTTLS, and AUTH PLAIN. Sufficient for transactional notifications;
 * deliberately boring infrastructure.
 */

export interface SmtpClientOptions {
  host: string;
  port: number;
  /** Implicit TLS (smtps://). Plain smtp:// otherwise. */
  secure?: boolean;
  username?: string;
  password?: string;
  /** Envelope MAIL FROM address. */
  from: string;
  connectTimeoutMs?: number;
}

export interface SmtpSendOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
}

const CRLF = "\r\n";

export class SmtpClient {
  private readonly opts: SmtpClientOptions;
  /** Envelope sender, exposed so callers can default `From` consistently. */
  readonly sender: string;

  constructor(opts: SmtpClientOptions) {
    this.opts = { connectTimeoutMs: 10_000, ...opts };
    this.sender = opts.from;
  }

  async send(options: SmtpSendOptions): Promise<void> {
    const session = await SmtpSession.open(this.opts);
    try {
      await session.command(`EHLO ${this.opts.host}`, [250]);
      if (session.capabilities.has("STARTTLS") && !this.opts.secure) {
        await session.command("STARTTLS", [220]);
        await session.upgradeToTls();
        await session.command(`EHLO ${this.opts.host}`, [250]);
      }
      if (this.opts.username) {
        const token = Buffer.from(
          `\u0000${this.opts.username}\u0000${this.opts.password ?? ""}`,
        ).toString("base64");
        await session.command(`AUTH PLAIN ${token}`, [235]);
      }
      await session.command(`MAIL FROM:<${options.from}>`, [250]);
      await session.command(`RCPT TO:<${options.to}>`, [250, 251, 252]);
      await session.command("DATA", [354]);
      await session.writeMessage(buildMessage(options));
      await session.command("QUIT", [221]);
    } finally {
      session.close();
    }
  }
}

function buildMessage(opts: SmtpSendOptions): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    `Date: ${new Date().toUTCString()}`,
    "Auto-Submitted: auto-generated",
  ].join(CRLF);
  // RFC 5321 §4.5.2: dot-stuff lines that begin with ".".
  const body = opts.text.replace(/^\./gm, "..");
  return `${headers}${CRLF}${CRLF}${body}`;
}

/** Parses smtp:// or smtps:// URLs (username:password@host:port). */
export function parseSmtpUrl(url: string, fallbackFrom: string): SmtpClientOptions {
  const parsed = new URL(url);
  if (parsed.protocol !== "smtp:" && parsed.protocol !== "smtps:") {
    throw new Error(`Unsupported SMTP URL scheme "${parsed.protocol}" (expected smtp: or smtps:)`);
  }
  const secure = parsed.protocol === "smtps:";
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : secure ? 465 : 25,
    secure,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    from: fallbackFrom,
  };
}

class SmtpSession {
  private socket: Socket;
  private buffer = "";
  private replyParts: string[] = [];
  private pendingResolve: ((reply: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  capabilities = new Set<string>();

  private constructor(socket: Socket) {
    this.socket = socket;
  }

  static async open(opts: SmtpClientOptions): Promise<SmtpSession> {
    const socket = opts.secure
      ? tlsConnect({ host: opts.host, port: opts.port })
      : netConnect({ host: opts.host, port: opts.port });
    const session = new SmtpSession(socket);

    socket.setTimeout(opts.connectTimeoutMs ?? 10_000, () => {
      session.rejectPending(new Error("SMTP connection timed out"));
      socket.destroy();
    });
    socket.on("error", (err) => session.rejectPending(err));
    socket.on("data", (chunk) => session.consume(chunk));
    socket.on("close", () => session.rejectPending(new Error("SMTP connection closed")));

    await new Promise<void>((resolve, reject) => {
      const readyEvent = opts.secure ? "secureConnect" : "connect";
      socket.once(readyEvent, () => resolve());
      socket.once("error", reject);
    });
    socket.setTimeout(0); // connection established; clear idle timeout

    await session.expect([220]);
    return session;
  }

  async command(line: string, accepted: number[]): Promise<void> {
    this.write(line);
    await this.expect(accepted);
  }

  async expect(accepted: number[]): Promise<string> {
    const reply = await this.readReply();
    const code = Number.parseInt(reply.slice(0, 3), 10);
    if (!accepted.includes(code)) {
      throw new Error(`SMTP: expected ${accepted.join("/")} but server replied: ${reply}`);
    }
    return reply;
  }

  async writeMessage(message: string): Promise<void> {
    // write() appends the final CRLF, so the wire is "message\r\n.\r\n".
    this.write(message + CRLF + ".");
    await this.expect([250]);
  }

  async upgradeToTls(): Promise<void> {
    const plain = this.socket;
    plain.removeAllListeners("data");
    plain.removeAllListeners("close");
    plain.removeAllListeners("error");
    const tlsSocket = tlsConnect({ socket: plain as never });
    this.socket = tlsSocket as unknown as Socket;
    tlsSocket.on("data", (chunk) => this.consume(chunk));
    tlsSocket.on("error", (err) => this.rejectPending(err));
    tlsSocket.on("close", () => this.rejectPending(new Error("SMTP TLS connection closed")));
    await new Promise<void>((resolve, reject) => {
      tlsSocket.once("secureConnect", () => resolve());
      tlsSocket.once("error", reject);
    });
  }

  close(): void {
    this.socket.destroy();
  }

  private write(line: string): void {
    this.socket.write(line + CRLF);
  }

  private consume(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      const raw = this.buffer.slice(0, nl).replace(/\r$/, "");
      this.buffer = this.buffer.slice(nl + 1);
      if (raw.length >= 4 && /^\d{3} /.test(raw)) {
        // Final line of a (possibly multi-line) reply - resolve the pending read.
        const reply = this.replyParts.length ? `${this.replyParts.join("\n")}\n${raw}` : raw;
        this.replyParts = [];
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          this.pendingReject = null;
          resolve(reply);
        }
      } else if (raw.length >= 4 && /^\d{3}-/.test(raw)) {
        this.replyParts.push(raw);
        const capability = raw.slice(4).trim();
        if (/^[A-Z][A-Z0-9]*$/.test(capability)) this.capabilities.add(capability);
      } else {
        this.replyParts.push(raw);
      }
    }
  }

  private readReply(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
    });
  }

  private rejectPending(err: Error): void {
    if (this.pendingReject) {
      const reject = this.pendingReject;
      this.pendingReject = null;
      this.pendingResolve = null;
      reject(err);
    }
  }
}
