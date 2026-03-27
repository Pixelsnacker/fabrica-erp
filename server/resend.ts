/**
 * resend.ts — E-Mail-Versand via Resend API
 * Verwendet für: Kundenportal-Einladung, @Mention-Benachrichtigung
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Fabrica ERP <noreply@fabrica3d.eu>";

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

async function sendResendEmail(payload: ResendEmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[Resend] RESEND_API_KEY nicht gesetzt — E-Mail wird nicht gesendet");
    return { success: false, error: "RESEND_API_KEY nicht konfiguriert" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      const errMsg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
      console.error("[Resend] Fehler:", errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[Resend] Netzwerkfehler:", err.message);
    return { success: false, error: err.message ?? "Unbekannter Fehler" };
  }
}

// ─── Kundenportal-Einladung ───────────────────────────────────────────────────
export async function sendInvitationEmail(opts: {
  to: string;
  customerName?: string;
  projectTitle: string;
  portalUrl: string;
  projectId: number;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = opts.customerName
    ? `Sehr geehrte/r ${opts.customerName},`
    : "Sehr geehrte Damen und Herren,";

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
  <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Fabrica ERP — Kundenportal</h1>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p>${greeting}</p>
    <p>Sie wurden eingeladen, das Kundenportal für Ihr Projekt <strong>${opts.projectTitle}</strong> zu nutzen.</p>
    <p>Über das Portal können Sie:</p>
    <ul>
      <li>Den aktuellen Projektstatus einsehen</li>
      <li>Nachrichten mit unserem Team austauschen</li>
      <li>Dokumente und Dateien teilen</li>
    </ul>
    <div style="margin:24px 0;text-align:center;">
      <a href="${opts.portalUrl}" 
         style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
        Zum Kundenportal
      </a>
    </div>
    <p style="font-size:12px;color:#64748b;">
      Oder kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${opts.portalUrl}" style="color:#2563eb;">${opts.portalUrl}</a>
    </p>
    <p style="font-size:12px;color:#64748b;">Das Passwort für das Portal erhalten Sie separat von Ihrem Ansprechpartner.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">
      Mit freundlichen Grüßen<br>
      <strong>Daniel Rincón</strong><br>
      Fabrica GmbH · Hüttenstraße 205 · 50170 Kerpen-Sindorf<br>
      Tel.: +49(0)2273-9529429 · d.rincon@fabrica3d.eu
    </p>
  </div>
</body>
</html>`;

  return sendResendEmail({
    from: FROM_EMAIL,
    to: [opts.to],
    subject: `Einladung zum Kundenportal: ${opts.projectTitle}`,
    html,
    text: `${greeting}\n\nSie wurden zum Kundenportal für Projekt "${opts.projectTitle}" eingeladen.\n\nLink: ${opts.portalUrl}\n\nMit freundlichen Grüßen\nDaniel Rincón\nFabrica GmbH`,
  });
}

// ─── @Mention-Benachrichtigung ────────────────────────────────────────────────
export async function sendMentionNotification(opts: {
  to: string;
  projectTitle: string;
  projectId: number;
}): Promise<{ success: boolean; error?: string }> {
  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:16px;">Neue Nachricht im Kundenportal</h2>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px;">
    <p>Sie wurden in einer Nachricht zum Projekt <strong>${opts.projectTitle}</strong> erwähnt.</p>
    <p>Bitte melden Sie sich im Kundenportal an, um die Nachricht zu lesen und zu antworten.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">
      Mit freundlichen Grüßen<br>
      <strong>Daniel Rincón</strong> · Fabrica GmbH
    </p>
  </div>
</body>
</html>`;

  return sendResendEmail({
    from: FROM_EMAIL,
    to: [opts.to],
    subject: `Neue Nachricht: ${opts.projectTitle}`,
    html,
    text: `Sie wurden in einer Nachricht zum Projekt "${opts.projectTitle}" erwähnt. Bitte melden Sie sich im Kundenportal an.\n\nMit freundlichen Grüßen\nDaniel Rincón · Fabrica GmbH`,
  });
}

// ─── Todo-Zuweisung an Kunden ─────────────────────────────────────────────
export async function sendTodoAssignedEmail(opts: {
  to: string;
  customerName?: string;
  projectTitle: string;
  portalUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = opts.customerName
    ? `Sehr geehrte/r ${opts.customerName},`
    : "Sehr geehrte Damen und Herren,";

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
  <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Fabrica ERP — Neue Aufgabe</h1>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p>${greeting}</p>
    <p>Ihnen wurde eine neue Aufgabe im Projekt <strong>${opts.projectTitle}</strong> zugewiesen.</p>
    <p>Bitte öffnen Sie das Projektportal, um die Aufgabe einzusehen und zu bestätigen:</p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${opts.portalUrl}"
         style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
        Zum Kundenportal
      </a>
    </div>
    <p style="font-size:12px;color:#64748b;">
      Oder kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${opts.portalUrl}" style="color:#2563eb;">${opts.portalUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">
      Mit freundlichen Grüßen<br>
      <strong>Daniel Rincón</strong><br>
      Fabrica GmbH · Hüttenstraße 205 · 50170 Kerpen-Sindorf<br>
      Tel.: +49(0)2273-9529429 · d.rincon@fabrica3d.eu
    </p>
  </div>
</body>
</html>`;

  return sendResendEmail({
    from: FROM_EMAIL,
    to: [opts.to],
    subject: `Neue Aufgabe in Projekt ${opts.projectTitle}`,
    html,
    text: `${greeting}\n\nIhnen wurde eine neue Aufgabe im Projekt "${opts.projectTitle}" zugewiesen.\n\nBitte öffnen Sie das Projektportal: ${opts.portalUrl}\n\nMit freundlichen Grüßen\nDaniel Rincón · Fabrica GmbH`,
  });
}

// ─── API-Key-Validierung (für Tests) ─────────────────────────────────────────────
export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY && RESEND_API_KEY.startsWith("re_");
}
