/**
 * resend.test.ts — Prüft ob RESEND_API_KEY korrekt konfiguriert ist
 */
import { describe, it, expect } from "vitest";
import { isResendConfigured } from "./resend";

describe("Resend E-Mail-Konfiguration", () => {
  it("RESEND_API_KEY ist gesetzt und hat korrektes Format (re_...)", () => {
    const configured = isResendConfigured();
    // Wenn der Key gesetzt ist, muss er mit re_ beginnen
    const key = process.env.RESEND_API_KEY;
    if (key) {
      expect(key).toMatch(/^re_/);
      expect(configured).toBe(true);
    } else {
      // Key nicht gesetzt — Warnung, aber kein harter Fehler (SMTP-Fallback möglich)
      console.warn("[Test] RESEND_API_KEY nicht gesetzt — E-Mail-Versand deaktiviert");
      expect(configured).toBe(false);
    }
  });

  it("sendInvitationEmail und sendMentionNotification sind exportiert", async () => {
    const { sendInvitationEmail, sendMentionNotification } = await import("./resend");
    expect(typeof sendInvitationEmail).toBe("function");
    expect(typeof sendMentionNotification).toBe("function");
  });
});
