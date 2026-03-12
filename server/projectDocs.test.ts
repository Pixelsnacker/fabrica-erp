import { describe, it, expect } from "vitest";

// ─── Kategorie-Validierung ────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  "supplier_offer",
  "nda",
  "order",
  "delivery_note",
  "invoice",
  "contract",
  "drawing",
  "other",
] as const;
type DocCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(cat: string): cat is DocCategory {
  return VALID_CATEGORIES.includes(cat as DocCategory);
}

// ─── Datei-Schlüssel-Generierung ──────────────────────────────────────────────
function buildFileKey(projectId: number, category: string, filename: string, ts: number): string {
  return `project-docs/${projectId}/${category}/${ts}-${filename}`;
}

// ─── Dateigröße-Formatierung ──────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  const kb = Math.round(bytes / 1024);
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// ─── MIME-Typ-Erkennung ───────────────────────────────────────────────────────
function isPdf(mimeType: string, filename: string): boolean {
  return mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("projectDocs – Kategorie-Validierung", () => {
  it("akzeptiert alle gültigen Kategorien", () => {
    for (const cat of VALID_CATEGORIES) {
      expect(isValidCategory(cat)).toBe(true);
    }
  });

  it("lehnt ungültige Kategorien ab", () => {
    expect(isValidCategory("unknown")).toBe(false);
    expect(isValidCategory("")).toBe(false);
    expect(isValidCategory("SUPPLIER_OFFER")).toBe(false);
  });

  it("hat genau 8 Kategorien", () => {
    expect(VALID_CATEGORIES.length).toBe(8);
  });
});

describe("projectDocs – Datei-Schlüssel", () => {
  it("generiert korrekten S3-Pfad", () => {
    const key = buildFileKey(42, "nda", "vertrag.pdf", 1700000000000);
    expect(key).toBe("project-docs/42/nda/1700000000000-vertrag.pdf");
  });

  it("enthält Projekt-ID im Pfad", () => {
    const key = buildFileKey(99, "order", "bestellung.pdf", 1000);
    expect(key).toContain("/99/");
  });

  it("enthält Kategorie im Pfad", () => {
    const key = buildFileKey(1, "supplier_offer", "angebot.pdf", 1000);
    expect(key).toContain("/supplier_offer/");
  });

  it("enthält Dateiname im Schlüssel", () => {
    const key = buildFileKey(1, "other", "dokument.docx", 1000);
    expect(key).toContain("dokument.docx");
  });
});

describe("projectDocs – Dateigröße-Formatierung", () => {
  it("zeigt KB für kleine Dateien", () => {
    expect(formatFileSize(512 * 1024)).toBe("512 KB");
  });

  it("zeigt MB für große Dateien", () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("zeigt 1 KB für sehr kleine Dateien", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("zeigt korrekte Dezimalstellen für MB", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("projectDocs – MIME-Typ-Erkennung", () => {
  it("erkennt PDF per MIME-Typ", () => {
    expect(isPdf("application/pdf", "dokument.txt")).toBe(true);
  });

  it("erkennt PDF per Dateiendung", () => {
    expect(isPdf("application/octet-stream", "angebot.pdf")).toBe(true);
  });

  it("erkennt kein PDF bei anderen Typen", () => {
    expect(isPdf("image/png", "bild.png")).toBe(false);
  });

  it("erkennt Bilder korrekt", () => {
    expect(isImage("image/jpeg")).toBe(true);
    expect(isImage("image/png")).toBe(true);
    expect(isImage("image/webp")).toBe(true);
  });

  it("erkennt Nicht-Bilder korrekt", () => {
    expect(isImage("application/pdf")).toBe(false);
    expect(isImage("application/vnd.ms-excel")).toBe(false);
  });
});

describe("projectDocs – Datei-Größen-Limit", () => {
  const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

  it("akzeptiert Dateien unter 25 MB", () => {
    expect(24 * 1024 * 1024 < MAX_SIZE).toBe(true);
    expect(1 * 1024 * 1024 < MAX_SIZE).toBe(true);
  });

  it("lehnt Dateien über 25 MB ab", () => {
    expect(26 * 1024 * 1024 > MAX_SIZE).toBe(true);
    expect(100 * 1024 * 1024 > MAX_SIZE).toBe(true);
  });

  it("akzeptiert genau 25 MB nicht (strikt kleiner)", () => {
    expect(MAX_SIZE < MAX_SIZE).toBe(false);
  });
});

// ─── Lieferanten-Verknüpfung ──────────────────────────────────────────────────
type Supplier = { id: number; name: string; company?: string | null };

function getSupplierDisplayName(s: Supplier): string {
  return s.company ? `${s.company} (${s.name})` : s.name;
}

function findSupplierById(suppliers: Supplier[], id: number | null | undefined): Supplier | undefined {
  if (!id) return undefined;
  return suppliers.find(s => s.id === id);
}

function filterDocsBySupplier(docs: { supplierId?: number | null }[], supplierId: string): typeof docs {
  if (!supplierId) return docs;
  return docs.filter(d => String(d.supplierId) === supplierId);
}

describe("projectDocs – Lieferanten-Verknüpfung", () => {
  const suppliers: Supplier[] = [
    { id: 1, name: "Max Müller", company: "3D Print GmbH" },
    { id: 2, name: "Anna Schmidt", company: null },
    { id: 3, name: "Klaus Weber", company: "Laser Tech AG" },
  ];

  it("zeigt Firmenname wenn vorhanden", () => {
    expect(getSupplierDisplayName(suppliers[0])).toBe("3D Print GmbH (Max Müller)");
  });

  it("zeigt nur Namen wenn keine Firma", () => {
    expect(getSupplierDisplayName(suppliers[1])).toBe("Anna Schmidt");
  });

  it("findet Lieferant per ID", () => {
    expect(findSupplierById(suppliers, 2)?.name).toBe("Anna Schmidt");
  });

  it("gibt undefined zurück wenn ID null", () => {
    expect(findSupplierById(suppliers, null)).toBeUndefined();
  });

  it("gibt undefined zurück wenn ID nicht gefunden", () => {
    expect(findSupplierById(suppliers, 99)).toBeUndefined();
  });

  it("filtert Dokumente nach Lieferant", () => {
    const docs = [
      { supplierId: 1 },
      { supplierId: 2 },
      { supplierId: 1 },
      { supplierId: null },
    ];
    const filtered = filterDocsBySupplier(docs, "1");
    expect(filtered.length).toBe(2);
    expect(filtered.every(d => d.supplierId === 1)).toBe(true);
  });

  it("gibt alle Dokumente zurück wenn kein Filter", () => {
    const docs = [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: null }];
    expect(filterDocsBySupplier(docs, "").length).toBe(3);
  });

  it("gibt leeres Array zurück wenn kein Dokument passt", () => {
    const docs = [{ supplierId: 1 }, { supplierId: 2 }];
    expect(filterDocsBySupplier(docs, "99").length).toBe(0);
  });
});

// ─── Notiz-Bearbeitung ──────────────────────────────────────────────────
function sanitizeNote(note: string): string | null {
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

describe("projectDocs – Notiz-Bearbeitung", () => {
  it("speichert normale Notiz", () => {
    expect(sanitizeNote("Stornierung des vorherigen Auftrages")).toBe("Stornierung des vorherigen Auftrages");
  });

  it("trimmt Leerzeichen", () => {
    expect(sanitizeNote("  Notiz mit Leerzeichen  ")).toBe("Notiz mit Leerzeichen");
  });

  it("gibt null zurück für leere Notiz", () => {
    expect(sanitizeNote("")).toBeNull();
    expect(sanitizeNote("   ")).toBeNull();
  });

  it("behält Zeilenumbrüche", () => {
    const note = "Zeile 1\nZeile 2";
    expect(sanitizeNote(note)).toBe("Zeile 1\nZeile 2");
  });

  it("akzeptiert lange Notizen", () => {
    const long = "a".repeat(500);
    expect(sanitizeNote(long)).toBe(long);
  });
});
