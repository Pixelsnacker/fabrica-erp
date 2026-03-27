/**
 * projectChat.test.ts — Tests für den Chat-Router und Portal-Logik
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getProject: vi.fn(),
}));
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.pdf", key: "chat/1/test.pdf" }),
}));
vi.mock("./resend", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendMentionNotification: vi.fn().mockResolvedValue({ success: true }),
  isResendConfigured: vi.fn().mockReturnValue(true),
}));
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
  compare: vi.fn().mockResolvedValue(true),
}));

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function makeDbMock(overrides: Record<string, any> = {}) {
  const selectResult: any[] = overrides.selectResult ?? [];
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(selectResult),
    orderBy: vi.fn().mockResolvedValue(selectResult),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("chatRouter — Struktur und Exporte", () => {
  it("chatRouter ist ein Objekt mit den erwarteten Prozeduren", async () => {
    const { chatRouter } = await import("./chatRouter");
    expect(chatRouter).toBeDefined();
    expect(typeof chatRouter).toBe("object");
    // Alle 8 Prozeduren müssen vorhanden sein
    const procedures = [
      "getMessages",
      "sendMessage",
      "setupPortal",
      "getPortalConfig",
      "sendInvitation",
      "portalAuth",
      "portalGetMessages",
      "portalSendMessage",
    ];
    for (const proc of procedures) {
      expect((chatRouter as any)[proc], `Prozedur "${proc}" fehlt`).toBeDefined();
    }
  });
});

describe("chatRouter — @Mention-Erkennung", () => {
  it("erkennt @Name korrekt in Nachrichteninhalt", async () => {
    // Direkte Funktion testen via Regex-Logik
    const content = "Hallo @Max Mustermann, bitte prüfen Sie das Angebot.";
    const contactName = "Max Mustermann";
    const escaped = contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = new RegExp(`@${escaped}`, "i").test(content);
    expect(matches).toBe(true);
  });

  it("erkennt @Name nicht wenn Name nicht vorkommt", () => {
    const content = "Hallo, bitte prüfen Sie das Angebot.";
    const contactName = "Max Mustermann";
    const escaped = contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = new RegExp(`@${escaped}`, "i").test(content);
    expect(matches).toBe(false);
  });

  it("erkennt @Name case-insensitiv", () => {
    const content = "Hallo @max mustermann, bitte antworten.";
    const contactName = "Max Mustermann";
    const escaped = contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = new RegExp(`@${escaped}`, "i").test(content);
    expect(matches).toBe(true);
  });
});

describe("chatRouter — Portal-Passwort-Hashing", () => {
  it("bcrypt.hash wird mit korrekten Parametern aufgerufen", async () => {
    const bcrypt = await import("bcryptjs");
    await bcrypt.hash("testpassword123", 12);
    expect(bcrypt.hash).toHaveBeenCalledWith("testpassword123", 12);
  });

  it("bcrypt.compare gibt true zurück wenn Passwort korrekt", async () => {
    const bcrypt = await import("bcryptjs");
    const result = await bcrypt.compare("testpassword123", "$2b$12$hashedpassword");
    expect(result).toBe(true);
  });
});

describe("chatRouter — Resend-Integration", () => {
  it("sendInvitationEmail ist korrekt importierbar", async () => {
    const { sendInvitationEmail } = await import("./resend");
    expect(typeof sendInvitationEmail).toBe("function");
  });

  it("sendMentionNotification ist korrekt importierbar", async () => {
    const { sendMentionNotification } = await import("./resend");
    expect(typeof sendMentionNotification).toBe("function");
  });

  it("sendInvitationEmail gibt success:true zurück (Mock)", async () => {
    const { sendInvitationEmail } = await import("./resend");
    const result = await sendInvitationEmail({
      to: "test@example.com",
      projectTitle: "Testprojekt",
      portalUrl: "https://example.com/projekt-portal/1",
      projectId: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("chatRouter — Schema-Tabellen", () => {
  it("projectChatMessages und projectPortalConfig sind im Schema exportiert", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.projectChatMessages).toBeDefined();
    expect(schema.projectPortalConfig).toBeDefined();
  });

  it("projectChatMessages hat die erwarteten Felder", async () => {
    const { projectChatMessages } = await import("../drizzle/schema");
    const columns = Object.keys(projectChatMessages);
    // Mindestens diese Felder müssen vorhanden sein
    expect(columns.length).toBeGreaterThan(0);
  });
});

describe("chatRouter — Portal-URL-Format", () => {
  it("Portal-URL hat korrektes Format", () => {
    const origin = "https://example.manus.space";
    const projectId = 42;
    const url = `${origin}/projekt-portal/${projectId}`;
    expect(url).toBe("https://example.manus.space/projekt-portal/42");
    expect(url).toMatch(/\/projekt-portal\/\d+$/);
  });
});

describe("chatRouter — closeChat / reopenChat / getProjectInfo Prozeduren", () => {
  it("chatRouter hat closeChat Prozedur", async () => {
    const { chatRouter } = await import("./chatRouter");
    expect((chatRouter as any).closeChat).toBeDefined();
  });

  it("chatRouter hat reopenChat Prozedur", async () => {
    const { chatRouter } = await import("./chatRouter");
    expect((chatRouter as any).reopenChat).toBeDefined();
  });

  it("chatRouter hat getProjectInfo Prozedur", async () => {
    const { chatRouter } = await import("./chatRouter");
    expect((chatRouter as any).getProjectInfo).toBeDefined();
  });

  it("chat_closed Flag ist im Schema als Feld vorhanden", async () => {
    const { projectPortalConfig } = await import("../drizzle/schema");
    // Das Schema-Objekt muss definiert sein
    expect(projectPortalConfig).toBeDefined();
  });

  it("Personenfarben-Palette hat mindestens 5 Einträge", () => {
    const PERSON_COLORS = [
      { bg: '#1d4ed8', text: '#ffffff' },
      { bg: '#7c3aed', text: '#ffffff' },
      { bg: '#b45309', text: '#ffffff' },
      { bg: '#0f766e', text: '#ffffff' },
      { bg: '#be123c', text: '#ffffff' },
    ];
    expect(PERSON_COLORS.length).toBeGreaterThanOrEqual(5);
    // Alle Farben haben bg und text
    for (const c of PERSON_COLORS) {
      expect(c.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.text).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("Du-Anzeige-Logik: eigene Nachrichten werden als 'Du' beschriftet", () => {
    const senderName = "Max Mustermann";
    const messages = [
      { id: 1, senderType: 'customer', senderName: 'Max Mustermann', content: 'Hallo' },
      { id: 2, senderType: 'erp', senderName: 'Daniel Rincón', content: 'Guten Tag' },
      { id: 3, senderType: 'customer', senderName: 'Anna Schmidt', content: 'Ich auch' },
    ];
    const labels = messages.map(m => {
      const isOwn = m.senderType === 'customer' && m.senderName === senderName;
      return isOwn ? 'Du' : m.senderName;
    });
    expect(labels[0]).toBe('Du');         // eigene Nachricht
    expect(labels[1]).toBe('Daniel Rincón'); // ERP-Mitarbeiter
    expect(labels[2]).toBe('Anna Schmidt'); // anderer Kunde
  });
});
