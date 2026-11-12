/**
 * Store254 Email Notification & Security Dispatcher
 * Official Platform Sender: recovery@store254.co.ke
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  apiKey?: string;
  redactInLogs?: string[];
}

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHttpsUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return escapeHtml(parsed.toString());
    }
  } catch {
    // Ignore invalid URLs
  }
  return null;
}

export class EmailService {
  private static DEFAULT_SENDER = "Store254 Security <password_recovery@store254.co.ke>";
  private static DEFAULT_SMTP_USER = "kelvinkamauofficial254@gmail.com";
  private static DEFAULT_SMTP_PASS = "xltdoykofhwfpylx";

  /**
   * Unified SMTP Socket interface supporting both Cloudflare Workers (cloudflare:sockets)
   * and Node.js (node:tls).
   */
  private static async createSmtpSocket(): Promise<{
    write: (data: string) => Promise<void>;
    readChunk: () => Promise<string | null>;
    close: () => Promise<void>;
  } | null> {
    // 1. Try Cloudflare Workers native socket (cloudflare:sockets)
    try {
      // @ts-ignore
      const cfSockets = await import("cloudflare:sockets");
      if (cfSockets && typeof cfSockets.connect === "function") {
        const socket = cfSockets.connect(
          { hostname: "smtp.gmail.com", port: 465 },
          { secureTransport: "on" }
        );
        if (socket.opened) {
          await socket.opened;
        }
        const writer = socket.writable.getWriter();
        const reader = socket.readable.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        return {
          write: async (d: string) => {
            await writer.write(encoder.encode(d));
          },
          readChunk: async () => {
            const { value, done } = await reader.read();
            if (done || !value) return null;
            return decoder.decode(value);
          },
          close: async () => {
            try { await writer.close(); } catch {}
            try { await socket.close(); } catch {}
          }
        };
      }
    } catch {
      // Not in Cloudflare Workers environment or cloudflare:sockets unavailable
    }

    // 2. Fallback: Node.js node:tls
    try {
      // @ts-ignore
      const tls = await import("node:tls");
      return new Promise((resolve) => {
        const socket = tls.connect(465, "smtp.gmail.com", () => {
          const queue: string[] = [];
          let waiter: ((chunk: string | null) => void) | null = null;
          let isClosed = false;

          socket.on("data", (chunk: any) => {
            const str = chunk.toString("utf-8");
            if (waiter) {
              const w = waiter;
              waiter = null;
              w(str);
            } else {
              queue.push(str);
            }
          });

          socket.on("error", (err: any) => {
            console.error("[EmailService SMTP TLS Error]", err);
            isClosed = true;
            if (waiter) {
              const w = waiter;
              waiter = null;
              w(null);
            }
          });

          socket.on("close", () => {
            isClosed = true;
            if (waiter) {
              const w = waiter;
              waiter = null;
              w(null);
            }
          });

          resolve({
            write: async (data: string) => {
              return new Promise<void>((res, rej) => {
                socket.write(data, (err: any) => {
                  if (err) rej(err);
                  else res();
                });
              });
            },
            readChunk: async () => {
              if (queue.length > 0) return queue.shift()!;
              if (isClosed) return null;
              return new Promise<string | null>((res) => {
                waiter = res;
              });
            },
            close: async () => {
              try { socket.end(); socket.destroy(); } catch {}
            }
          });
        });

        socket.on("error", (err: any) => {
          console.error("[EmailService Socket Connect Error]", err);
          resolve(null);
        });
      });
    } catch (err) {
      console.error("[EmailService Import TLS Error]", err);
      return null;
    }
  }

  /**
   * Dispatches an email via direct Gmail SMTP over TLS on port 465
   */
  private static async sendViaGmailSmtp(options: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<boolean> {
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
    const user = (typeof proc !== "undefined" && proc?.env?.GMAIL_SMTP_USER) || this.DEFAULT_SMTP_USER;
    const rawPass = (typeof proc !== "undefined" && proc?.env?.GMAIL_SMTP_PASS) || this.DEFAULT_SMTP_PASS;
    const pass = rawPass.replace(/\s+/g, "");
    const from = options.from || (typeof proc !== "undefined" && proc?.env?.GMAIL_SENDER) || this.DEFAULT_SENDER;

    try {
      const socket = await this.createSmtpSocket();
      if (!socket) return false;

      let buffer = "";

      const readLine = async (): Promise<string | null> => {
        while (true) {
          const crlfIdx = buffer.indexOf("\r\n");
          if (crlfIdx !== -1) {
            const line = buffer.slice(0, crlfIdx);
            buffer = buffer.slice(crlfIdx + 2);
            return line;
          }
          const chunk = await socket.readChunk();
          if (chunk === null) return null;
          buffer += chunk;
        }
      };

      const readResponse = async (): Promise<{ code: number; text: string } | null> => {
        let lastLine = "";
        while (true) {
          const line = await readLine();
          if (line === null) return null;
          lastLine = line;
          if (line.length >= 3 && line.charAt(3) !== "-") {
            const code = parseInt(line.slice(0, 3), 10);
            return { code, text: lastLine };
          }
        }
      };

      const greeting = await readResponse();
      if (!greeting || greeting.code !== 220) {
        await socket.close();
        return false;
      }

      await socket.write("EHLO store254.co.ke\r\n");
      const ehlo = await readResponse();
      if (!ehlo || ehlo.code !== 250) {
        await socket.close();
        return false;
      }

      await socket.write("AUTH LOGIN\r\n");
      const authPrompt1 = await readResponse();
      if (!authPrompt1 || authPrompt1.code !== 334) {
        await socket.close();
        return false;
      }

      await socket.write(btoa(user) + "\r\n");
      const authPrompt2 = await readResponse();
      if (!authPrompt2 || authPrompt2.code !== 334) {
        await socket.close();
        return false;
      }

      await socket.write(btoa(pass) + "\r\n");
      const authResult = await readResponse();
      if (!authResult || authResult.code !== 235) {
        console.error("[EmailService SMTP Auth Failed]", authResult?.text);
        await socket.close();
        return false;
      }

      await socket.write(`MAIL FROM:<${user}>\r\n`);
      const mailFrom = await readResponse();
      if (!mailFrom || mailFrom.code !== 250) {
        await socket.close();
        return false;
      }

      await socket.write(`RCPT TO:<${options.to}>\r\n`);
      const rcptTo = await readResponse();
      if (!rcptTo || rcptTo.code !== 250) {
        await socket.close();
        return false;
      }

      await socket.write("DATA\r\n");
      const dataPrompt = await readResponse();
      if (!dataPrompt || dataPrompt.code !== 354) {
        await socket.close();
        return false;
      }

      const normalizedHtml = options.html.replace(/\r?\n/g, "\r\n");
      const mimeMsg = [
        `From: ${from}`,
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        normalizedHtml,
        `.`,
        ``
      ].join("\r\n");

      await socket.write(mimeMsg);
      const dataResult = await readResponse();
      if (!dataResult || dataResult.code !== 250) {
        console.error("[EmailService SMTP Send Data Error]", dataResult?.text);
        await socket.close();
        return false;
      }

      try {
        await socket.write("QUIT\r\n");
      } catch {}
      await socket.close();

      console.log(`[EmailService] Delivered recovery email to ${options.to} via Gmail SMTP.`);
      return true;
    } catch (err) {
      console.error("[EmailService SMTP Session Error]", err);
      return false;
    }
  }

  /**
   * Dispatches an email via Gmail SMTP / Resend / MailChannels or local logger
   */
  public static async send(options: SendEmailOptions): Promise<boolean> {
    const from = options.from || this.DEFAULT_SENDER;

    // In automated tests, skip outbound SMTP so tests can assert local logging and redaction
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
    const isTest = typeof proc !== "undefined" && (proc.env?.NODE_ENV === "test" || Boolean(proc.env?.VITEST));

    // Try Gmail SMTP first with configured password_recovery credentials when not in test
    if (!isTest) {
      const smtpSuccess = await this.sendViaGmailSmtp({
        to: options.to,
        subject: options.subject,
        html: options.html,
        from,
      });
      if (smtpSuccess) {
        return true;
      }
    }

    // If an external email provider API key is provided (e.g. Resend)
    if (options.apiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [options.to],
            subject: options.subject,
            html: options.html,
          }),
        });

        return res.ok;
      } catch (err) {
        console.error("[EmailService Error]", err);
      }
    }

    let safeSubject = options.subject;
    let safeBody = options.html.replace(/<[^>]+>/g, " ");
    for (const secret of options.redactInLogs || []) {
      if (secret) {
        safeSubject = safeSubject.split(secret).join("[REDACTED]");
        safeBody = safeBody.split(secret).join("[REDACTED]");
      }
    }

    // Default development & test mode: Output to console with sensitive tokens redacted
    console.log(`
===================================================================
[STORE254 OUTGOING EMAIL]
From: ${from}
To: ${options.to}
Subject: ${safeSubject}
-------------------------------------------------------------------
${safeBody}
===================================================================
    `);

    return true;
  }

  /**
   * Password Reset OTP Email Template
   */
  public static async sendPasswordResetOtp(params: {
    to: string;
    fullName: string;
    otpCode: string;
    expiresMinutes: number;
    apiKey?: string;
  }): Promise<boolean> {
    const safeName = escapeHtml(params.fullName);
    const safeOtp = escapeHtml(params.otpCode);
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background: #f9fafb; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 24px; }
          .logo span { color: #2563eb; }
          .otp-box { background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0; border: 1px dashed #d1d5db; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; }
          .footer { font-size: 13px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
          .warning { font-size: 13px; color: #dc2626; margin-top: 12px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid #f3f4f6;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left" style="vertical-align: middle;">
                  <a href="https://store254.co.ke" target="_blank" style="text-decoration: none; display: inline-block;">
                    <img src="https://store254.co.ke/assets/Store254_Digital_Marketplace_Logo_transparent.png" alt="Store254" height="42" style="height: 42px; width: auto; max-width: 190px; display: block; border: 0;" />
                  </a>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px; text-transform: uppercase;">Security</span>
                </td>
              </tr>
            </table>
          </div>
          <h2>Password Recovery Request</h2>
          <p>Hello <strong>${safeName}</strong>,</p>
          <p>We received a request to reset the password for your account. Use the 6-digit One-Time PIN (OTP) below to proceed:</p>
          
          <div class="otp-box">
            <div class="otp-code">${safeOtp}</div>
          </div>
          
          <p>This code will expire in <strong>${Number(params.expiresMinutes) || 15} minutes</strong>.</p>
          <p class="warning">⚠️ Never share this OTP with anyone. Store254 staff will never ask for your recovery code.</p>
          
          <div class="footer">
            <p>If you did not request a password reset, please disregard this email or contact support immediately.</p>
            <p>&copy; Store254 Kenya. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    `;

    return this.send({
      to: params.to,
      subject: `[Store254] Your Password Reset OTP: ${params.otpCode}`,
      html,
      from: "Store254 Security <password_recovery@store254.co.ke>",
      apiKey: params.apiKey,
      redactInLogs: [params.otpCode],
    });
  }

  /**
   * Password Reset Link & OTP Email Template
   */
  public static async sendPasswordResetLink(params: {
    to: string;
    fullName: string;
    resetLink: string;
    otpCode: string;
    expiresMinutes: number;
    storeName?: string;
  }): Promise<boolean> {
    const safeName = escapeHtml(params.fullName);
    const safeOtp = escapeHtml(params.otpCode);
    const safeLink = sanitizeHttpsUrl(params.resetLink) || escapeHtml(params.resetLink);
    const safeStore = escapeHtml(params.storeName || "Store254");

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background: #f9fafb; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
          .logo { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 24px; }
          .logo span { color: #059669; }
          .btn { display: inline-block; background: #059669; color: #ffffff !important; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin: 20px 0; box-shadow: 0 2px 4px rgba(5,150,105,0.2); }
          .btn:hover { background: #047857; }
          .otp-box { background: #f0fdf4; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0; border: 1.5px dashed #86efac; }
          .otp-code { font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #166534; font-family: monospace; }
          .footer { font-size: 12px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
          .warning { font-size: 13px; color: #b91c1c; margin-top: 16px; font-weight: 500; }
          .break-link { word-break: break-all; font-size: 12px; color: #6b7280; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid #f3f4f6;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left" style="vertical-align: middle;">
                  <a href="https://store254.co.ke" target="_blank" style="text-decoration: none; display: inline-block;">
                    <img src="https://store254.co.ke/assets/Store254_Digital_Marketplace_Logo_transparent.png" alt="Store254" height="42" style="height: 42px; width: auto; max-width: 190px; display: block; border: 0;" />
                  </a>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px; text-transform: uppercase;">Security</span>
                </td>
              </tr>
            </table>
          </div>
          <h2>Reset Your Password</h2>
          <p>Hello <strong>${safeName}</strong>,</p>
          <p>We received a request to reset the password for your <strong>${safeStore}</strong> account. Click the button below to choose a new password:</p>
          
          <div style="text-align: center;">
            <a href="${safeLink}" class="btn" target="_blank">Reset My Password</a>
          </div>

          <p>Or if prompted on screen, you can also enter your 6-digit recovery PIN:</p>
          <div class="otp-box">
            <div class="otp-code">${safeOtp}</div>
          </div>
          
          <p>This reset link and PIN will expire in <strong>${Number(params.expiresMinutes) || 30} minutes</strong>.</p>
          <p class="warning">⚠️ If you did not make this request, you can safely ignore this email — your password will remain unchanged.</p>
          
          <div class="footer">
            <p>Button not working? Copy and paste this URL into your browser:</p>
            <p class="break-link"><a href="${safeLink}" style="color: #059669;">${safeLink}</a></p>
            <p style="margin-top: 16px;">&copy; Store254 Kenya. Sent by password_recovery@store254.co.ke</p>
          </div>
        </div>
      </body>
    </html>
    `;

    return this.send({
      to: params.to,
      subject: `[Store254] Reset Your Password`,
      html,
      from: "Store254 Security <password_recovery@store254.co.ke>",
      redactInLogs: [params.otpCode],
    });
  }

  /**
   * Onboarding Pending Activation Notice
   */
  public static async sendStorePendingActivation(params: {
    to: string;
    storeName: string;
    subdomain: string;
    primaryDomain: string;
    apiKey?: string;
  }): Promise<boolean> {
    const safeStoreName = escapeHtml(params.storeName);
    const safeSubdomain = escapeHtml(params.subdomain);
    const safePrimaryDomain = escapeHtml(params.primaryDomain);
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background: #f9fafb; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; }
          .logo { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 24px; }
          .logo span { color: #2563eb; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; background: #fef3c7; color: #92400e; font-weight: 600; font-size: 13px; margin-bottom: 16px; }
          .footer { font-size: 13px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <a href="https://store254.co.ke" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="https://store254.co.ke/assets/Store254_Digital_Marketplace_Logo_transparent.png" alt="Store254" height="42" style="height: 42px; width: auto; max-width: 190px; display: block; border: 0;" />
            </a>
          </div>
          <div class="badge">Application Under Review</div>
          <h2>Welcome to Store254!</h2>
          <p>Thank you for registering <strong>${safeStoreName}</strong> on the Store254 platform.</p>
          <p>Your requested subdomain is: <strong>${safeSubdomain}.${safePrimaryDomain}</strong></p>
          <p>As part of our trust & safety policy, all new store registrations are reviewed by our platform Super Admin team before going live. We verify business details to maintain a high-trust marketplace for all Kenyan consumers.</p>
          <p>You will receive an email as soon as your store account is activated (typically within 1-2 hours during business hours).</p>
          <div class="footer">
            <p>&copy; Store254 Kenya. Need help? Reach us at support@store254.co.ke</p>
          </div>
        </div>
      </body>
    </html>
    `;

    return this.send({
      to: params.to,
      subject: `[Store254] Application Received for ${params.storeName} (Pending Review)`,
      html,
      from: "Store254 Onboarding <welcome@store254.co.ke>",
      apiKey: params.apiKey,
    });
  }

  /**
   * Store Activated Notice
   */
  public static async sendStoreActivated(params: {
    to: string;
    storeName: string;
    subdomain: string;
    primaryDomain: string;
    apiKey?: string;
  }): Promise<boolean> {
    const safeStoreName = escapeHtml(params.storeName);
    const storeUrl = sanitizeHttpsUrl(`https://${params.subdomain}.${params.primaryDomain}`) || "#";
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background: #f9fafb; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; }
          .logo { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 24px; }
          .logo span { color: #2563eb; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; background: #d1fae5; color: #065f46; font-weight: 600; font-size: 13px; margin-bottom: 16px; }
          .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { font-size: 13px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <a href="https://store254.co.ke" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="https://store254.co.ke/assets/Store254_Digital_Marketplace_Logo_transparent.png" alt="Store254" height="42" style="height: 42px; width: auto; max-width: 190px; display: block; border: 0;" />
            </a>
          </div>
          <div class="badge">Store Activated</div>
          <h2>Your Store is Live! 🎉</h2>
          <p>Great news! The Store254 Super Admin team has reviewed and activated your business store: <strong>${safeStoreName}</strong>.</p>
          <p>Your online store is now accessible to customers at:</p>
          <p><a href="${storeUrl}" style="color: #2563eb; font-weight: 600; font-size: 16px;">${storeUrl}</a></p>
          
          <a href="${storeUrl}/admin" class="btn">Access Merchant Dashboard</a>
          
          <p>Next steps:</p>
          <ol>
            <li>Log in with your owner email and password.</li>
            <li>Configure your custom categories and add your products or services.</li>
            <li>In <strong>Settings &rarr; Payments</strong>, add your Safaricom M-Pesa Till or Paybill credentials and toggle it on.</li>
          </ol>
          <div class="footer">
            <p>&copy; Store254 Kenya. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    `;

    return this.send({
      to: params.to,
      subject: `[Store254] 🎉 Your store ${params.storeName} has been activated!`,
      html,
      from: "Store254 Team <support@store254.co.ke>",
      apiKey: params.apiKey,
    });
  }

  /**
   * Order Status Update Notification (Shipped, Processing, Completed)
   */
  public static async sendOrderStatusUpdate(params: {
    to: string;
    customerName: string;
    storeName: string;
    orderNumber: string;
    status: string;
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    notes?: string;
    apiKey?: string;
  }): Promise<boolean> {
    const safeStoreName = escapeHtml(params.storeName);
    const safeCustomerName = escapeHtml(params.customerName);
    const safeOrderNumber = escapeHtml(params.orderNumber);
    const safeStatus = escapeHtml(params.status);
    const safeCourier = escapeHtml(params.courierName);
    const safeTrackingNum = escapeHtml(params.trackingNumber);
    const safeTrackingUrl = sanitizeHttpsUrl(params.trackingUrl);
    const safeNotes = escapeHtml(params.notes);

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background: #f9fafb; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; }
          .header { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 20px; }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; background: #dbeafe; color: #1e40af; font-weight: 700; font-size: 14px; margin-bottom: 16px; }
          .tracking-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .footer { font-size: 13px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">${safeStoreName}</div>
          <div class="badge">Order Status: ${safeStatus}</div>
          <h2>Hello ${safeCustomerName},</h2>
          <p>Your order <strong>#${safeOrderNumber}</strong> has been updated to <strong>${safeStatus}</strong>.</p>
          
          ${
            safeCourier || safeTrackingNum
              ? `
          <div class="tracking-box">
            <h4 style="margin-bottom: 8px;">Delivery & Tracking Information</h4>
            ${safeCourier ? `<p><strong>Courier:</strong> ${safeCourier}</p>` : ""}
            ${safeTrackingNum ? `<p><strong>Tracking Number:</strong> ${safeTrackingNum}</p>` : ""}
            ${safeTrackingUrl ? `<p><a href="${safeTrackingUrl}" style="color: #2563eb; font-weight: 600;">Track Your Package &rarr;</a></p>` : ""}
            ${safeNotes ? `<p><em>${safeNotes}</em></p>` : ""}
          </div>
          `
              : ""
          }
          
          <div class="footer">
            <p>Thank you for shopping with ${safeStoreName} via Store254.</p>
          </div>
        </div>
      </body>
    </html>
    `;

    return this.send({
      to: params.to,
      subject: `[${params.storeName}] Update on Order #${params.orderNumber}: ${params.status}`,
      html,
      from: `${params.storeName.replace(/["<>]/g, "")} Orders <orders@store254.co.ke>`,
      apiKey: params.apiKey,
    });
  }
}
