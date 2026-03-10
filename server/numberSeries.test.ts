/**
 * Tests für die konfigurierbare Nummernvergabe-Logik
 * Testet die Formatierungs-Logik isoliert (ohne DB-Abhängigkeit)
 */

import { describe, it, expect } from "vitest";

// ─── Hilfsfunktion (spiegelt die Logik aus db.ts wider) ───────────────────────
function formatNumber(opts: {
  type: "invoice" | "offer" | "credit_note";
  num: number;
  offerPrefix?: string;
  invoicePrefix?: string;
  creditNotePrefix?: string;
  numberSeparator?: string;
  numberPadding?: number;
  includeYear?: boolean;
  year?: number;
}): string {
  const sep = opts.numberSeparator ?? "-";
  const padding = opts.numberPadding ?? 4;
  const includeYear = opts.includeYear ?? true;
  const year = opts.year ?? 2026;
  const prefix =
    opts.type === "invoice"
      ? (opts.invoicePrefix ?? "RE")
      : opts.type === "offer"
      ? (opts.offerPrefix ?? "AN")
      : (opts.creditNotePrefix ?? "GS");
  const paddedNum = String(opts.num).padStart(padding, "0");
  if (includeYear) {
    return `${prefix}${sep}${year}${sep}${paddedNum}`;
  }
  return `${prefix}${sep}${paddedNum}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Nummernkreis-Formatierung", () => {
  describe("Standard-Konfiguration (Werkseinstellungen)", () => {
    it("erzeugt Angebotsnummer mit Standard-Präfix AN", () => {
      expect(formatNumber({ type: "offer", num: 1, year: 2026 })).toBe("AN-2026-0001");
    });

    it("erzeugt Rechnungsnummer mit Standard-Präfix RE", () => {
      expect(formatNumber({ type: "invoice", num: 1, year: 2026 })).toBe("RE-2026-0001");
    });

    it("erzeugt Gutschriftnummer mit Standard-Präfix GS", () => {
      expect(formatNumber({ type: "credit_note", num: 1, year: 2026 })).toBe("GS-2026-0001");
    });

    it("erhöht die laufende Nummer korrekt", () => {
      expect(formatNumber({ type: "invoice", num: 42, year: 2026 })).toBe("RE-2026-0042");
      expect(formatNumber({ type: "invoice", num: 999, year: 2026 })).toBe("RE-2026-0999");
      expect(formatNumber({ type: "invoice", num: 10000, year: 2026 })).toBe("RE-2026-10000");
    });
  });

  describe("Benutzerdefinierter Präfix", () => {
    it("verwendet benutzerdefinierten Angebots-Präfix", () => {
      expect(formatNumber({ type: "offer", num: 1, offerPrefix: "ANG", year: 2026 })).toBe("ANG-2026-0001");
    });

    it("verwendet benutzerdefinierten Rechnungs-Präfix", () => {
      expect(formatNumber({ type: "invoice", num: 5, invoicePrefix: "INV", year: 2026 })).toBe("INV-2026-0005");
    });

    it("verwendet benutzerdefinierten Gutschrift-Präfix", () => {
      expect(formatNumber({ type: "credit_note", num: 3, creditNotePrefix: "CR", year: 2026 })).toBe("CR-2026-0003");
    });

    it("unterstützt leeren Präfix (nur Nummer)", () => {
      expect(formatNumber({ type: "offer", num: 1, offerPrefix: "", numberSeparator: "", year: 2026 })).toBe("20260001");
    });
  });

  describe("Benutzerdefiniertes Trennzeichen", () => {
    it("verwendet Punkt als Trennzeichen", () => {
      expect(formatNumber({ type: "invoice", num: 1, numberSeparator: ".", year: 2026 })).toBe("RE.2026.0001");
    });

    it("verwendet Schrägstrich als Trennzeichen", () => {
      expect(formatNumber({ type: "offer", num: 7, numberSeparator: "/", year: 2026 })).toBe("AN/2026/0007");
    });

    it("verwendet Unterstrich als Trennzeichen", () => {
      expect(formatNumber({ type: "invoice", num: 2, numberSeparator: "_", year: 2026 })).toBe("RE_2026_0002");
    });
  });

  describe("Konfigurierbare Nullstellen (Padding)", () => {
    it("verwendet 3 Stellen", () => {
      expect(formatNumber({ type: "invoice", num: 1, numberPadding: 3, year: 2026 })).toBe("RE-2026-001");
    });

    it("verwendet 6 Stellen", () => {
      expect(formatNumber({ type: "invoice", num: 1, numberPadding: 6, year: 2026 })).toBe("RE-2026-000001");
    });

    it("schneidet nicht ab wenn Nummer länger als Padding", () => {
      expect(formatNumber({ type: "invoice", num: 99999, numberPadding: 3, year: 2026 })).toBe("RE-2026-99999");
    });
  });

  describe("Jahreszahl ein-/ausschalten", () => {
    it("enthält Jahreszahl wenn includeYear=true", () => {
      expect(formatNumber({ type: "invoice", num: 1, includeYear: true, year: 2026 })).toBe("RE-2026-0001");
    });

    it("enthält keine Jahreszahl wenn includeYear=false", () => {
      expect(formatNumber({ type: "invoice", num: 1, includeYear: false, year: 2026 })).toBe("RE-0001");
    });

    it("Angebot ohne Jahreszahl", () => {
      expect(formatNumber({ type: "offer", num: 5, includeYear: false, offerPrefix: "ANG", year: 2026 })).toBe("ANG-0005");
    });
  });

  describe("Kombinierte Konfigurationen", () => {
    it("Fabrica-Stil: FAB/2026/00001", () => {
      expect(formatNumber({
        type: "invoice",
        num: 1,
        invoicePrefix: "FAB",
        numberSeparator: "/",
        numberPadding: 5,
        includeYear: true,
        year: 2026,
      })).toBe("FAB/2026/00001");
    });

    it("Kompakt-Stil ohne Jahr: RE-0042", () => {
      expect(formatNumber({
        type: "invoice",
        num: 42,
        invoicePrefix: "RE",
        numberSeparator: "-",
        numberPadding: 4,
        includeYear: false,
      })).toBe("RE-0042");
    });
  });
});
