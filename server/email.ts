/**
 * E-Mail-Versand via Nodemailer (SMTP)
 * Verwendet die SMTP-Einstellungen aus den Firmen-Einstellungen
 */
import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpSecure: boolean;
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: opts.smtpHost,
      port: opts.smtpPort,
      secure: opts.smtpSecure,
      auth: {
        user: opts.smtpUser,
        pass: opts.smtpPass,
      },
      tls: {
        rejectUnauthorized: false, // erlaubt self-signed certs
      },
    });

    const info = await transporter.sendMail({
      from: opts.smtpFrom || opts.smtpUser,
      to: opts.to,
      cc: opts.cc || undefined,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.html.replace(/<[^>]+>/g, ''),
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Unbekannter Fehler' };
  }
}

/**
 * Baut das HTML für eine Angebots-E-Mail
 */
export function buildOfferEmailHtml(opts: {
  invoiceNumber: string;
  recipientName?: string;
  recipientCompany?: string;
  senderName?: string;
  introText?: string;
  emailBody: string;
  emailSignature?: string;
  totalGross?: string;
  issueDate?: string;
  validUntil?: string;
}): string {
  const greeting = opts.recipientCompany
    ? `Sehr geehrte Damen und Herren,`
    : opts.recipientName
    ? `Sehr geehrte/r ${opts.recipientName},`
    : `Sehr geehrte Damen und Herren,`;

  const signatureHtml = opts.emailSignature
    ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;white-space:pre-wrap;">${opts.emailSignature}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:640px;margin:0 auto;padding:24px;">
  <p>${greeting}</p>
  <div style="white-space:pre-wrap;line-height:1.7;">${opts.emailBody}</div>
  <div style="margin:24px 0;padding:16px;background:#f9fafb;border-left:4px solid #2563eb;border-radius:4px;">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Angebotsnummer</p>
    <p style="margin:0;font-weight:700;font-size:16px;">${opts.invoiceNumber}</p>
    ${opts.totalGross ? `<p style="margin:4px 0 0;color:#16a34a;font-weight:600;">Gesamtbetrag: ${parseFloat(opts.totalGross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p>` : ''}
    ${opts.issueDate ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Datum: ${opts.issueDate}</p>` : ''}
    ${opts.validUntil ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Gültig bis: ${opts.validUntil}</p>` : ''}
  </div>
  <p style="color:#374151;">Das vollständige Angebot finden Sie im Anhang als PDF.</p>
  ${signatureHtml}
</body>
</html>`;
}
