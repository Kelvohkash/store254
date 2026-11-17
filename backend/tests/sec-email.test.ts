import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import * as tls from "node:tls";
import {
  EmailService,
  isValidEmailAddress,
  sanitizeEmailHeader,
  sanitizeHttpsUrl,
} from "../src/services/email.service";

vi.mock("node:tls", () => ({
  connect: vi.fn(),
}));

describe("EmailService security hardening (SEC-03 & SEC-20)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SEC-03: sanitizeHttpsUrl and safe resetLink HTML fallback", () => {
    it("accepts only https:// URLs and rejects javascript:, http:, and data: schemes", () => {
      expect(sanitizeHttpsUrl("https://store254.co.ke/admin.html?reset_token=abc&x=1")).toBe(
        "https://store254.co.ke/admin.html?reset_token=abc&amp;x=1"
      );
      expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeHttpsUrl("JAVASCRIPT:alert(1)")).toBeNull();
      expect(sanitizeHttpsUrl("http://store254.co.ke/admin.html?reset_token=abc")).toBeNull();
      expect(sanitizeHttpsUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeHttpsUrl("not a url")).toBeNull();
      expect(sanitizeHttpsUrl("")).toBeNull();
      expect(sanitizeHttpsUrl(null)).toBeNull();
    });

    it("falls back to '#' in sendPasswordResetLink rendered HTML when resetLink is javascript: or http:", async () => {
      const sendSpy = vi.spyOn(EmailService, "send").mockResolvedValue(true);

      await EmailService.sendPasswordResetLink({
        to: "owner@example.com",
        fullName: "Test Owner",
        resetLink: "javascript:alert(document.cookie)",
        otpCode: "123456",
        expiresMinutes: 30,
      });

      const jsCallHtml = sendSpy.mock.calls[0][0].html;
      expect(jsCallHtml).toContain('href="#"');
      expect(jsCallHtml).not.toContain("javascript:");

      await EmailService.sendPasswordResetLink({
        to: "owner@example.com",
        fullName: "Test Owner",
        resetLink: "http://store254.co.ke/admin.html?reset_token=plainhttp",
        otpCode: "123456",
        expiresMinutes: 30,
      });

      const httpCallHtml = sendSpy.mock.calls[1][0].html;
      expect(httpCallHtml).toContain('href="#"');
      expect(httpCallHtml).not.toContain("http://store254.co.ke");
    });
  });

  describe("SEC-20: SMTP / MIME header injection defense", () => {
    it("strips CR, LF, and ASCII control characters from header values", () => {
      expect(sanitizeEmailHeader("Order Update\r\nBcc: evil@example.com\x00\x1f\x7f")).toBe(
        "Order UpdateBcc: evil@example.com"
      );
      expect(sanitizeEmailHeader("Shop\nCc: attacker@example.com")).toBe(
        "ShopCc: attacker@example.com"
      );
    });

    it("validates recipient email addresses and rejects newlines or control characters", () => {
      expect(isValidEmailAddress("customer@example.com")).toBe(true);
      expect(isValidEmailAddress("user+tag@sub.store254.co.ke")).toBe(true);
      expect(isValidEmailAddress("victim@example.com\r\nBcc: evil@example.com")).toBe(false);
      expect(isValidEmailAddress("victim@example.com\n")).toBe(false);
      expect(isValidEmailAddress("victim@example.com\x00")).toBe(false);
      expect(isValidEmailAddress("Attacker <evil@example.com>")).toBe(false);
      expect(isValidEmailAddress("a@example.com, b@example.com")).toBe(false);
      expect(isValidEmailAddress("invalid-email")).toBe(false);
    });

    it("strips injected headers from From, Reply-To, To, and Subject in buildMimeMessage", () => {
      const mime = EmailService.buildMimeMessage({
        from: "Store\r\nBcc: evil@example.com Orders <orders@store254.co.ke>",
        replyTo: "reply@store254.co.ke\r\nBcc: evil2@example.com",
        to: "customer@example.com\r\nBcc: evil3@example.com",
        subject: "Order #101\r\nBcc: evil4@example.com\nX-Injected: yes",
        html: "<p>Hello</p>",
      });

      const [headerSection] = mime.split("\r\n\r\n");
      const headerLines = headerSection.split("\r\n");
      expect(headerLines.some((line) => /^Bcc:/i.test(line))).toBe(false);
      expect(headerLines.some((line) => /^X-Injected:/i.test(line))).toBe(false);
      expect(headerLines).toContain("From: StoreBcc: evil@example.com Orders <orders@store254.co.ke>");
      expect(headerLines).toContain("Reply-To: reply@store254.co.keBcc: evil2@example.com");
      expect(headerLines).toContain("To: customer@example.comBcc: evil3@example.com");
      expect(headerLines).toContain("Subject: Order #101Bcc: evil4@example.comX-Injected: yes");
    });

    it("rejects send() when recipient 'to' contains CRLF header injection", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await EmailService.send({
        to: "victim@example.com\r\nBcc: evil@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result).toBe(false);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("sanitizes merchant storeName in sendOrderStatusUpdate before MIME generation over SMTP", async () => {
      const writtenPayloads: string[] = [];
      const connectMock = vi.mocked(tls.connect);

      connectMock.mockImplementation(((_port: number, _host: string, cb?: () => void) => {
        const socket = new EventEmitter() as EventEmitter & {
          write: (data: string, writeCb?: (err?: Error | null) => void) => void;
          end: () => void;
          destroy: () => void;
        };
        socket.write = (data: string, writeCb?: (err?: Error | null) => void) => {
          writtenPayloads.push(data);
          writeCb?.(null);
          if (data.startsWith("EHLO")) socket.emit("data", Buffer.from("250 OK\r\n"));
          else if (data === "AUTH LOGIN\r\n") socket.emit("data", Buffer.from("334 VXNlcm5hbWU6\r\n"));
          else if (writtenPayloads.filter((d) => !d.startsWith("EHLO") && d !== "AUTH LOGIN\r\n").length === 1) {
            socket.emit("data", Buffer.from("334 UGFzc3dvcmQ6\r\n"));
          } else if (writtenPayloads.filter((d) => !d.startsWith("EHLO") && d !== "AUTH LOGIN\r\n").length === 2) {
            socket.emit("data", Buffer.from("235 Accepted\r\n"));
          } else if (data.startsWith("MAIL FROM:")) socket.emit("data", Buffer.from("250 OK\r\n"));
          else if (data.startsWith("RCPT TO:")) socket.emit("data", Buffer.from("250 OK\r\n"));
          else if (data === "DATA\r\n") socket.emit("data", Buffer.from("354 Go ahead\r\n"));
          else if (data.includes("MIME-Version: 1.0")) socket.emit("data", Buffer.from("250 Queued\r\n"));
        };
        socket.end = () => {};
        socket.destroy = () => {};

        queueMicrotask(() => {
          cb?.();
          socket.emit("data", Buffer.from("220 smtp.gmail.com ESMTP\r\n"));
        });
        return socket as unknown as tls.TLSSocket;
      }) as unknown as typeof tls.connect);

      const origVitest = process.env.VITEST;
      const origNodeEnv = process.env.NODE_ENV;
      vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        delete process.env.VITEST;
        delete process.env.NODE_ENV;

        const sent = await EmailService.sendOrderStatusUpdate({
          to: "buyer@example.com",
          customerName: "Alice",
          storeName: "Shop\r\nBcc: evil@example.com",
          orderNumber: "ORD-42\r\nCc: evil2@example.com",
          status: "SHIPPED\nX-Evil: 1",
          smtp: {
            user: "mailer@store254.co.ke",
            pass: "app-password",
            sender: "Store254 <orders@store254.co.ke>",
          },
        });

        expect(sent).toBe(true);
        const mimePayload = writtenPayloads.find((p) => p.includes("MIME-Version: 1.0"));
        expect(mimePayload).toBeDefined();
        const [headerSection] = mimePayload!.split("\r\n\r\n");
        const headerLines = headerSection.split("\r\n");
        expect(headerLines.some((line) => /^Bcc:/i.test(line))).toBe(false);
        expect(headerLines.some((line) => /^Cc:/i.test(line))).toBe(false);
        expect(headerLines.some((line) => /^X-Evil:/i.test(line))).toBe(false);
      } finally {
        if (origVitest !== undefined) process.env.VITEST = origVitest;
        if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
      }
    });
  });

  describe("SEC-20: Reset link and token redaction in console fallback logs", () => {
    it("redacts resetLink, HTML-escaped query params, reset_token, and otpCode in console logs", async () => {
      const logs: string[] = [];
      vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        logs.push(args.join(" "));
      });

      const secretToken = "tok-super-secret-998877";
      const otpCode = "445566";
      const resetLink = `https://store254.co.ke/admin.html?reset_token=${secretToken}&email=owner@example.com`;

      const sent = await EmailService.sendPasswordResetLink({
        to: "owner@example.com",
        fullName: "Store Owner",
        resetLink,
        otpCode,
        expiresMinutes: 30,
      });

      expect(sent).toBe(true);
      const output = logs.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain(secretToken);
      expect(output).not.toContain("reset_token=");
      expect(output).not.toContain(resetLink);
      expect(output).not.toContain(otpCode);
    });
  });
});
