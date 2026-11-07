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
}

export class EmailService {
  private static DEFAULT_SENDER = "Store254 Security <recovery@store254.co.ke>";

  /**
   * Dispatches an email via Resend / MailChannels / Cloudflare Workers Email or local logger
   */
  public static async send(options: SendEmailOptions): Promise<boolean> {
    const from = options.from || this.DEFAULT_SENDER;

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

    // Default development & test mode: Output to console with full trace
    console.log(`
===================================================================
[STORE254 OUTGOING EMAIL]
From: ${from}
To: ${options.to}
Subject: ${options.subject}
-------------------------------------------------------------------
${options.html.replace(/<[^>]+>/g, " ")}
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
          <div class="logo">Store<span>254</span> Security</div>
          <h2>Password Recovery Request</h2>
          <p>Hello <strong>${params.fullName}</strong>,</p>
          <p>We received a request to reset the password for your account. Use the 6-digit One-Time PIN (OTP) below to proceed:</p>
          
          <div class="otp-box">
            <div class="otp-code">${params.otpCode}</div>
          </div>
          
          <p>This code will expire in <strong>${params.expiresMinutes} minutes</strong>.</p>
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
      from: "Store254 Recovery <recovery@store254.co.ke>",
      apiKey: params.apiKey,
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
          <div class="logo">Store<span>254</span></div>
          <div class="badge">Application Under Review</div>
          <h2>Welcome to Store254!</h2>
          <p>Thank you for registering <strong>${params.storeName}</strong> on the Store254 platform.</p>
          <p>Your requested subdomain is: <strong>${params.subdomain}.${params.primaryDomain}</strong></p>
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
    const storeUrl = `https://${params.subdomain}.${params.primaryDomain}`;
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
          <div class="logo">Store<span>254</span></div>
          <div class="badge">Store Activated</div>
          <h2>Your Store is Live! 🎉</h2>
          <p>Great news! The Store254 Super Admin team has reviewed and activated your business store: <strong>${params.storeName}</strong>.</p>
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
}
