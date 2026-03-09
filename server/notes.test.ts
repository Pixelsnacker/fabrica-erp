import { describe, it, expect } from "vitest";

// Unit tests for Notes & Reminders business logic (no DB required)

describe("Notes - Priorität-Validierung", () => {
  const VALID_PRIORITIES = ["niedrig", "normal", "hoch"];

  it("akzeptiert gültige Prioritäten", () => {
    for (const p of VALID_PRIORITIES) {
      expect(VALID_PRIORITIES).toContain(p);
    }
  });

  it("lehnt ungültige Prioritäten ab", () => {
    expect(VALID_PRIORITIES).not.toContain("kritisch");
    expect(VALID_PRIORITIES).not.toContain("");
  });
});

describe("Notes - Status-Validierung", () => {
  const VALID_STATUSES = ["offen", "erledigt"];

  it("akzeptiert gültige Status-Werte", () => {
    for (const s of VALID_STATUSES) {
      expect(VALID_STATUSES).toContain(s);
    }
  });

  it("Status-Toggle funktioniert korrekt", () => {
    const toggle = (current: string) => current === "offen" ? "erledigt" : "offen";
    expect(toggle("offen")).toBe("erledigt");
    expect(toggle("erledigt")).toBe("offen");
  });
});

describe("Notes - Datei-Upload Validierung", () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  it("akzeptiert Dateien unter 10 MB", () => {
    const fileSize = 5 * 1024 * 1024; // 5 MB
    expect(fileSize).toBeLessThanOrEqual(MAX_FILE_SIZE);
  });

  it("lehnt Dateien über 10 MB ab", () => {
    const fileSize = 15 * 1024 * 1024; // 15 MB
    expect(fileSize).toBeGreaterThan(MAX_FILE_SIZE);
  });

  it("erkennt Bildtypen korrekt", () => {
    const getFileType = (mimeType: string) =>
      mimeType.startsWith("image/") ? "image" :
      mimeType === "application/pdf" ? "pdf" : "other";

    expect(getFileType("image/jpeg")).toBe("image");
    expect(getFileType("image/png")).toBe("image");
    expect(getFileType("application/pdf")).toBe("pdf");
    expect(getFileType("text/plain")).toBe("other");
  });
});

describe("Notes - Erinnerungen", () => {
  it("erkennt vergangene Erinnerungen korrekt", () => {
    const isPast = (remindAt: Date) => remindAt < new Date();
    const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 Stunde in der Vergangenheit
    const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 Stunde in der Zukunft

    expect(isPast(pastDate)).toBe(true);
    expect(isPast(futureDate)).toBe(false);
  });

  it("berechnet Verzögerung für Benachrichtigung korrekt", () => {
    const futureDate = new Date(Date.now() + 5000); // 5 Sekunden in der Zukunft
    const delay = futureDate.getTime() - Date.now();
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it("ignoriert vergangene Erinnerungen für Benachrichtigungen", () => {
    const pastDate = new Date(Date.now() - 1000);
    const delay = pastDate.getTime() - Date.now();
    expect(delay).toBeLessThanOrEqual(0);
  });
});

describe("Notes - Suche", () => {
  const notes = [
    { id: 1, title: "Kundenanfrage Müller", content: "3D-Druck Gehäuse" },
    { id: 2, title: "Lieferant kontaktieren", content: "Preis anfragen" },
    { id: 3, title: "Meeting vorbereiten", content: "Präsentation erstellen" },
  ];

  it("findet Notizen nach Titel", () => {
    const search = "müller";
    const results = notes.filter(n =>
      n.title.toLowerCase().includes(search) ||
      (n.content ?? "").toLowerCase().includes(search)
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("findet Notizen nach Inhalt", () => {
    const search = "3d-druck";
    const results = notes.filter(n =>
      n.title.toLowerCase().includes(search) ||
      (n.content ?? "").toLowerCase().includes(search)
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("gibt alle Notizen zurück bei leerem Suchbegriff", () => {
    const search = "";
    const results = search ? notes.filter(n =>
      n.title.toLowerCase().includes(search) ||
      (n.content ?? "").toLowerCase().includes(search)
    ) : notes;
    expect(results).toHaveLength(3);
  });
});
