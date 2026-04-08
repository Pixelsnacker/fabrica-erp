import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerExportRoutes } from "../exportZip";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDueNoteReminders, markReminderSent, getOverdueInvoicesForReminder, markOverdueReminderSent, markInvoicesAsOverdue, getCompanySettings } from "../db";
import { sendEmail } from "../email";
import { notifyOwner } from "./notification";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // ZIP-Export
  registerExportRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

// ─── Cron-Job: Fällige Erinnerungen prüfen und via Manus Push senden ──────────
// Läuft jede Minute, sendet Push-Benachrichtigung an Manus Mobile App + Web
setInterval(async () => {
  try {
    const due = await getDueNoteReminders();
    for (const reminder of due) {
      const title = reminder.label
        ? `🔔 ${reminder.label}`
        : `🔔 Erinnerung: ${reminder.noteTitle}`;
      const content = [
        `Notiz: ${reminder.noteTitle}`,
        reminder.noteContent ? reminder.noteContent.slice(0, 400) : "",
      ].filter(Boolean).join("\n\n");
      const sent = await notifyOwner({
        title,
        content: content || `Erinnerung für Notiz: ${reminder.noteTitle}`,
      });
      if (sent) {
        await markReminderSent(reminder.id);
        console.log(`[Reminder] Push gesendet für #${reminder.id}: ${title}`);
      }
    }
  } catch (err) {
    console.error("[Reminder] Fehler beim Prüfen fälliger Erinnerungen:", err);
  }
}, 60 * 1000); // jede Minute

// ─── Cron-Job: Überfällige Rechnungen prüfen und E-Mail senden ─────────────────
// Läuft täglich um 08:00 Uhr (alle 24h, erster Lauf nach 10 Sekunden)
let overdueLastRun = 0;
setInterval(async () => {
  try {
    const now = new Date();
    const hour = now.getHours();
    // Nur zwischen 07:50 und 08:10 Uhr ausführen (einmal täglich)
    if (hour < 7 || hour > 8) return;
    const today = now.toISOString().slice(0, 10);
    if (overdueLastRun === parseInt(today.replace(/-/g, ''))) return; // heute schon gelaufen
    overdueLastRun = parseInt(today.replace(/-/g, ''));

    // Schritt 1: Status aller fälligen Rechnungen auf 'overdue' setzen (unabhängig von E-Mail-Einstellung)
    const updated = await markInvoicesAsOverdue();
    if (updated > 0) console.log(`[OverdueStatus] ${updated} Rechnung(en) auf 'overdue' gesetzt`);

    // Schritt 2: E-Mail-Erinnerung (nur wenn aktiviert)
    const settings = await getCompanySettings();
    if (!settings?.overdueReminderEnabled) return;

    const reminderEmail = settings.overdueReminderEmail || settings.email || settings.smtpUser;
    if (!reminderEmail) {
      console.warn('[OverdueReminder] Keine E-Mail-Adresse konfiguriert');
      return;
    }

    const overdue = await getOverdueInvoicesForReminder();
    if (overdue.length === 0) {
      console.log('[OverdueReminder] Keine überfälligen Rechnungen');
      return;
    }

    // E-Mail-Tabelle mit allen überfälligen Rechnungen
    const rows = overdue.map(inv => {
      const parts = (inv.dueDate ?? '').split('-');
      const dateDE = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : inv.dueDate ?? '';
      const amount = inv.totalGross ? parseFloat(inv.totalGross).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '—';
      const recipient = [inv.recipientCompany, inv.recipientName].filter(Boolean).join(' / ') || '—';
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${inv.invoiceNumber}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${recipient}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-weight:600;">${dateDE}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${amount}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:700px;margin:0 auto;padding:24px;">
  <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">⚠️ Fabrica ERP — Überfällige Rechnungen</h1>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p>Guten Morgen,</p>
    <p>folgende <strong>${overdue.length} Rechnung${overdue.length !== 1 ? 'en sind' : ' ist'} überfällig</strong> und noch nicht bezahlt:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Rechnungs-Nr.</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Empfänger</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Fällig am</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;">Betrag</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#64748b;">Diese E-Mail wurde automatisch von Fabrica ERP gesendet.</p>
  </div>
</body>
</html>`;

    if (settings.smtpHost && settings.smtpUser && settings.smtpPass) {
      const result = await sendEmail({
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort ?? 587,
        smtpUser: settings.smtpUser,
        smtpPass: settings.smtpPass,
        smtpFrom: settings.smtpFrom || settings.smtpUser,
        smtpSecure: !!settings.smtpSecure,
        to: reminderEmail,
        subject: `⚠️ ${overdue.length} überfällige Rechnung${overdue.length !== 1 ? 'en' : ''} — ${today}`,
        html,
      });
      if (result.success) {
        for (const inv of overdue) await markOverdueReminderSent(inv.id);
        console.log(`[OverdueReminder] E-Mail gesendet an ${reminderEmail} (${overdue.length} Rechnungen)`);
      } else {
        console.error('[OverdueReminder] E-Mail-Fehler:', result.error);
      }
    } else {
      console.warn('[OverdueReminder] SMTP nicht konfiguriert — nur Manus-Push');
      await notifyOwner({
        title: `⚠️ ${overdue.length} überfällige Rechnung${overdue.length !== 1 ? 'en' : ''}`,
        content: overdue.map(i => `${i.invoiceNumber}: ${[i.recipientCompany, i.recipientName].filter(Boolean).join(' ')} — fällig ${i.dueDate}`).join('\n'),
      });
    }
  } catch (err) {
    console.error('[OverdueReminder] Fehler:', err);
  }
}, 10 * 60 * 1000); // alle 10 Minuten prüfen, aber nur einmal täglich ausführen
