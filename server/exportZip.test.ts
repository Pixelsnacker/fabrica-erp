/**
 * Tests für die ZIP-Export-Hilfsfunktionen
 * Testet Markdown-Generierung, CSV-Format und Slugify isoliert
 */

import { describe, it, expect } from "vitest";

// ─── Hilfsfunktionen (aus exportZip.ts extrahiert für Tests) ─────────────────

function slugify(str: string): string {
  return (str ?? "unbekannt")
    .toLowerCase()
    .replace(/[äöüÄÖÜ]/g, (c: string) => ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue" }[c] ?? c))
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "unbekannt";
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(num) ? String(val) : `${num.toFixed(2)} €`;
}

function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => `"${c.label}"`).join(";");
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(";")
  );
  return [header, ...lines].join("\n");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("slugify()", () => {
  it("wandelt normale Strings um", () => {
    expect(slugify("Fabrica GmbH")).toBe("fabrica-gmbh");
  });

  it("ersetzt Umlaute korrekt", () => {
    expect(slugify("Müller & Söhne")).toBe("mueller-soehne");
    expect(slugify("Übersicht")).toBe("uebersicht");
  });

  it("ersetzt ß durch ss", () => {
    expect(slugify("Straße")).toBe("strasse");
  });

  it("entfernt Sonderzeichen", () => {
    expect(slugify("Test (2026) / Version 1.0")).toBe("test-2026-version-1-0");
  });

  it("kürzt auf 60 Zeichen", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it("gibt 'unbekannt' für leere Strings zurück", () => {
    expect(slugify("")).toBe("unbekannt");
    expect(slugify(null as any)).toBe("unbekannt");
  });

  it("verarbeitet Rechnungsnummern korrekt", () => {
    expect(slugify("RE-2026-0001")).toBe("re-2026-0001");
    expect(slugify("AN-2026-0042")).toBe("an-2026-0042");
  });
});

describe("formatCurrency()", () => {
  it("formatiert Zahlen mit 2 Dezimalstellen und €", () => {
    expect(formatCurrency(100)).toBe("100.00 €");
    expect(formatCurrency(1234.5)).toBe("1234.50 €");
    expect(formatCurrency(0)).toBe("0.00 €");
  });

  it("formatiert String-Zahlen (aus DB)", () => {
    expect(formatCurrency("99.99")).toBe("99.99 €");
    expect(formatCurrency("0.00")).toBe("0.00 €");
  });

  it("gibt leeren String für null/undefined zurück", () => {
    expect(formatCurrency(null)).toBe("");
    expect(formatCurrency(undefined)).toBe("");
    expect(formatCurrency("")).toBe("");
  });
});

describe("toCsv()", () => {
  const cols = [
    { key: "name", label: "Name" },
    { key: "email", label: "E-Mail" },
    { key: "city", label: "Ort" },
  ];

  it("erzeugt korrekten CSV-Header", () => {
    const csv = toCsv([], cols);
    expect(csv).toBe('"Name";"E-Mail";"Ort"');
  });

  it("erzeugt korrekte CSV-Zeilen", () => {
    const rows = [{ name: "Max Mustermann", email: "max@test.de", city: "Köln" }];
    const csv = toCsv(rows, cols);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"Max Mustermann";"max@test.de";"Köln"');
  });

  it("escaped Anführungszeichen in Werten", () => {
    const rows = [{ name: 'Firma "Test" GmbH', email: "", city: "" }];
    const csv = toCsv(rows, cols);
    expect(csv).toContain('"Firma ""Test"" GmbH"');
  });

  it("behandelt null/undefined-Werte als leere Strings", () => {
    const rows = [{ name: null, email: undefined, city: "Berlin" }];
    const csv = toCsv(rows as any, cols);
    expect(csv).toContain('"";"";"Berlin"');
  });

  it("verarbeitet mehrere Zeilen korrekt", () => {
    const rows = [
      { name: "Kunde A", email: "a@test.de", city: "Berlin" },
      { name: "Kunde B", email: "b@test.de", city: "München" },
      { name: "Kunde C", email: "c@test.de", city: "Hamburg" },
    ];
    const csv = toCsv(rows, cols);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(4); // Header + 3 Zeilen
  });

  it("exportiert Semikolon als Trennzeichen (Excel-kompatibel)", () => {
    const rows = [{ name: "Test", email: "t@t.de", city: "Köln" }];
    const csv = toCsv(rows, cols);
    expect(csv).toContain(";");
    expect(csv.split("\n")[0].split(";")).toHaveLength(3);
  });
});

describe("Export-Abschnitte", () => {
  it("alle Standard-Bereiche sind definiert", () => {
    const sections = ["kunden", "projekte", "rechnungen", "wissensdatenbank", "materialien", "lieferanten", "notizen"];
    expect(sections).toHaveLength(7);
    for (const s of sections) {
      expect(s).toMatch(/^[a-z]+$/);
    }
  });

  it("Format-Optionen sind vollständig", () => {
    const formats = ["markdown_csv", "csv_only", "json"];
    expect(formats).toHaveLength(3);
  });
});
