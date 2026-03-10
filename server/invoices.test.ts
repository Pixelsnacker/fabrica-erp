/**
 * Vitest-Tests für das GoBD-konforme Rechnungsmodul
 * Testet: Nummernvergabe, Steuerberechnung, Hash-Generierung, DATEV-Export
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";

// ─── Hilfsfunktionen (aus db.ts extrahiert für Unit-Tests) ────────────────────

function generateInvoiceNumber(type: string, year: number, seq: number): string {
  const prefix = type === "offer" ? "ANG" : type === "credit_note" ? "GUT" : "RE";
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function calcTax(netAmount: number, taxRate: number): number {
  return Math.round(netAmount * taxRate) / 100;
}

function calcGross(netAmount: number, taxRate: number): number {
  return netAmount + calcTax(netAmount, taxRate);
}

function generateDocumentHash(data: object): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha256").update(json).digest("hex");
}

function isValidInvoiceNumber(num: string): boolean {
  return /^(RE|ANG|GUT)-\d{4}-\d{4}$/.test(num);
}

function buildDatevRow(inv: {
  invoiceNumber: string;
  issueDate: string;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  taxRate: number;
  recipientCompany?: string;
  recipientName?: string;
}): string {
  const name = [inv.recipientCompany, inv.recipientName].filter(Boolean).join(" ");
  const date = inv.issueDate?.replace(/-/g, "").slice(4) ?? "";
  return [
    inv.totalNet.toFixed(2),
    inv.taxRate === 0 ? "Keine" : `${inv.taxRate}%`,
    inv.totalTax.toFixed(2),
    inv.totalGross.toFixed(2),
    date,
    inv.invoiceNumber,
    name,
  ].join(";");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Rechnungsnummer-Generierung", () => {
  it("generiert korrekte Rechnungsnummer für Rechnung", () => {
    const num = generateInvoiceNumber("invoice", 2026, 1);
    expect(num).toBe("RE-2026-0001");
  });

  it("generiert korrekte Rechnungsnummer für Angebot", () => {
    const num = generateInvoiceNumber("offer", 2026, 42);
    expect(num).toBe("ANG-2026-0042");
  });

  it("generiert korrekte Rechnungsnummer für Gutschrift", () => {
    const num = generateInvoiceNumber("credit_note", 2026, 7);
    expect(num).toBe("GUT-2026-0007");
  });

  it("füllt Sequenznummer auf 4 Stellen auf", () => {
    const num = generateInvoiceNumber("invoice", 2026, 999);
    expect(num).toBe("RE-2026-0999");
  });

  it("validiert korrektes Format", () => {
    expect(isValidInvoiceNumber("RE-2026-0001")).toBe(true);
    expect(isValidInvoiceNumber("ANG-2026-0042")).toBe(true);
    expect(isValidInvoiceNumber("GUT-2026-0007")).toBe(true);
  });

  it("lehnt ungültige Formate ab", () => {
    expect(isValidInvoiceNumber("R-2026-0001")).toBe(false);
    expect(isValidInvoiceNumber("RE-26-0001")).toBe(false);
    expect(isValidInvoiceNumber("RE-2026-001")).toBe(false);
    expect(isValidInvoiceNumber("")).toBe(false);
  });
});

describe("Steuerberechnung §14 UStG", () => {
  it("berechnet 19% MwSt korrekt", () => {
    const net = 1000;
    const tax = calcTax(net, 19);
    expect(tax).toBe(190);
  });

  it("berechnet 7% MwSt korrekt", () => {
    const net = 1000;
    const tax = calcTax(net, 7);
    expect(tax).toBe(70);
  });

  it("berechnet 0% MwSt (Kleinunternehmer) korrekt", () => {
    const net = 1000;
    const tax = calcTax(net, 0);
    expect(tax).toBe(0);
  });

  it("berechnet Bruttobetrag mit 19% korrekt", () => {
    const net = 1000;
    const gross = calcGross(net, 19);
    expect(gross).toBe(1190);
  });

  it("berechnet Bruttobetrag mit 7% korrekt", () => {
    const net = 500;
    const gross = calcGross(net, 7);
    expect(gross).toBe(535);
  });

  it("berechnet Steuer für Dezimalbeträge korrekt", () => {
    // 100.00 * 19% = 19.00
    const tax = calcTax(100, 19);
    expect(tax).toBe(19);
  });

  it("Brutto = Netto bei 0% (Kleinunternehmer)", () => {
    const net = 2500;
    const gross = calcGross(net, 0);
    expect(gross).toBe(net);
  });
});

describe("GoBD-Manipulationsschutz (SHA-256 Hash)", () => {
  it("generiert deterministischen Hash für gleiche Daten", () => {
    const data = { invoiceNumber: "RE-2026-0001", totalGross: 1190, issueDate: "2026-03-10" };
    const hash1 = generateDocumentHash(data);
    const hash2 = generateDocumentHash(data);
    expect(hash1).toBe(hash2);
  });

  it("generiert unterschiedliche Hashes für unterschiedliche Daten", () => {
    const data1 = { invoiceNumber: "RE-2026-0001", totalGross: 1190 };
    const data2 = { invoiceNumber: "RE-2026-0001", totalGross: 1191 };
    expect(generateDocumentHash(data1)).not.toBe(generateDocumentHash(data2));
  });

  it("Hash ist 64 Zeichen (SHA-256 Hex)", () => {
    const hash = generateDocumentHash({ test: "data" });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("Hash ist unabhängig von Schlüsselreihenfolge (kanonisch)", () => {
    const data1 = { a: 1, b: 2, c: 3 };
    const data2 = { c: 3, a: 1, b: 2 };
    expect(generateDocumentHash(data1)).toBe(generateDocumentHash(data2));
  });
});

describe("DATEV-Export Format", () => {
  const testInvoice = {
    invoiceNumber: "RE-2026-0001",
    issueDate: "2026-03-10",
    totalNet: 1000,
    totalTax: 190,
    totalGross: 1190,
    taxRate: 19,
    recipientCompany: "Musterfirma GmbH",
    recipientName: "Max Mustermann",
  };

  it("generiert korrekte DATEV-Zeile mit Semikolon-Trennung", () => {
    const row = buildDatevRow(testInvoice);
    const parts = row.split(";");
    expect(parts).toHaveLength(7);
  });

  it("enthält Nettobetrag als erste Spalte", () => {
    const row = buildDatevRow(testInvoice);
    expect(row.startsWith("1000.00")).toBe(true);
  });

  it("enthält Steuersatz als zweite Spalte", () => {
    const row = buildDatevRow(testInvoice);
    const parts = row.split(";");
    expect(parts[1]).toBe("19%");
  });

  it("enthält Rechnungsnummer als sechste Spalte", () => {
    const row = buildDatevRow(testInvoice);
    const parts = row.split(";");
    expect(parts[5]).toBe("RE-2026-0001");
  });

  it("zeigt 'Keine' für 0% Steuersatz (Kleinunternehmer)", () => {
    const inv = { ...testInvoice, taxRate: 0, totalTax: 0, totalGross: 1000 };
    const row = buildDatevRow(inv);
    const parts = row.split(";");
    expect(parts[1]).toBe("Keine");
  });

  it("kombiniert Firma und Name in Empfänger-Spalte", () => {
    const row = buildDatevRow(testInvoice);
    const parts = row.split(";");
    expect(parts[6]).toBe("Musterfirma GmbH Max Mustermann");
  });
});

describe("Statusübergänge (GoBD-Workflow)", () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["sent", "cancelled"],
    sent: ["accepted", "rejected", "cancelled"],
    accepted: ["invoiced", "cancelled"],
    invoiced: ["paid", "cancelled"],
    paid: [],
    cancelled: [],
    rejected: [],
  };

  function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it("Entwurf kann gesendet werden", () => {
    expect(canTransition("draft", "sent")).toBe(true);
  });

  it("Bezahlte Rechnung kann nicht mehr geändert werden", () => {
    expect(canTransition("paid", "cancelled")).toBe(false);
    expect(canTransition("paid", "draft")).toBe(false);
  });

  it("Stornierte Rechnung ist final", () => {
    expect(canTransition("cancelled", "draft")).toBe(false);
    expect(canTransition("cancelled", "sent")).toBe(false);
  });

  it("Angenommenes Angebot kann in Rechnung umgewandelt werden", () => {
    expect(canTransition("accepted", "invoiced")).toBe(true);
  });

  it("Gesendetes Angebot kann abgelehnt werden", () => {
    expect(canTransition("sent", "rejected")).toBe(true);
  });
});

// ─── Tests für Angebot → Rechnung Konvertierung ─────────────────────────────
describe("Angebot → Rechnung Konvertierung", () => {
  // Hilfsfunktion: simuliert die Konvertierungslogik aus routers.ts
  function convertOfferToInvoice(offer: {
    type: string;
    invoiceNumber: string;
    customerId?: number;
    projectId?: number;
    senderName?: string;
    recipientName?: string;
    recipientCompany?: string;
    subtotalNet?: string;
    taxAmount?: string;
    totalGross?: string;
    taxMode?: string;
    items?: Array<{ position: number; description: string; unitPriceNet: string }>;
  }, newInvoiceNumber: string) {
    if (offer.type !== 'offer') throw new Error('Nur Angebote können konvertiert werden');
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return {
      invoiceNumber: newInvoiceNumber,
      type: 'invoice',
      status: 'draft',
      customerId: offer.customerId,
      projectId: offer.projectId,
      senderName: offer.senderName,
      recipientName: offer.recipientName,
      recipientCompany: offer.recipientCompany,
      subtotalNet: offer.subtotalNet,
      taxAmount: offer.taxAmount,
      totalGross: offer.totalGross,
      taxMode: offer.taxMode,
      issueDate: today,
      dueDate,
      items: (offer.items ?? []).map(item => ({ ...item, invoiceId: 0 })),
    };
  }

  it("konvertiert Angebot in Rechnung mit korrektem Typ", () => {
    const offer = { type: 'offer', invoiceNumber: 'ANG-2026-0001', totalGross: '1190.00' };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    expect(result.type).toBe('invoice');
  });

  it("neue Rechnung erhält Status 'draft'", () => {
    const offer = { type: 'offer', invoiceNumber: 'ANG-2026-0001' };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    expect(result.status).toBe('draft');
  });

  it("neue Rechnungsnummer wird korrekt übernommen", () => {
    const offer = { type: 'offer', invoiceNumber: 'ANG-2026-0001' };
    const result = convertOfferToInvoice(offer, 'RE-2026-0042');
    expect(result.invoiceNumber).toBe('RE-2026-0042');
  });

  it("Kundendaten werden vollständig übernommen", () => {
    const offer = {
      type: 'offer',
      invoiceNumber: 'ANG-2026-0001',
      customerId: 5,
      projectId: 12,
      senderName: 'Fabrica GmbH',
      recipientName: 'Max Mustermann',
      recipientCompany: 'Musterfirma GmbH',
    };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    expect(result.customerId).toBe(5);
    expect(result.projectId).toBe(12);
    expect(result.senderName).toBe('Fabrica GmbH');
    expect(result.recipientName).toBe('Max Mustermann');
    expect(result.recipientCompany).toBe('Musterfirma GmbH');
  });

  it("Beträge werden aus dem Angebot übernommen", () => {
    const offer = {
      type: 'offer',
      invoiceNumber: 'ANG-2026-0001',
      subtotalNet: '1000.00',
      taxAmount: '190.00',
      totalGross: '1190.00',
    };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    expect(result.subtotalNet).toBe('1000.00');
    expect(result.taxAmount).toBe('190.00');
    expect(result.totalGross).toBe('1190.00');
  });

  it("Positionen werden vollständig übernommen", () => {
    const offer = {
      type: 'offer',
      invoiceNumber: 'ANG-2026-0001',
      items: [
        { position: 1, description: '3D-Druck Gehäuse', unitPriceNet: '250.00' },
        { position: 2, description: 'Nachbearbeitung', unitPriceNet: '50.00' },
      ],
    };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].description).toBe('3D-Druck Gehäuse');
    expect(result.items[1].description).toBe('Nachbearbeitung');
  });

  it("Fälligkeitsdatum ist ca. 14 Tage nach heute", () => {
    const offer = { type: 'offer', invoiceNumber: 'ANG-2026-0001' };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    // Datum-Differenz in Tagen (Datum-String-Vergleich, timezone-unabhängig)
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueDateStr = result.dueDate;
    const todayMs = new Date(todayStr).getTime();
    const dueMs = new Date(dueDateStr).getTime();
    const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(14);
  });

  it("Ausstellungsdatum ist heute", () => {
    const offer = { type: 'offer', invoiceNumber: 'ANG-2026-0001' };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    const today = new Date().toISOString().slice(0, 10);
    expect(result.issueDate).toBe(today);
  });

  it("wirft Fehler wenn kein Angebot übergeben wird", () => {
    const invoice = { type: 'invoice', invoiceNumber: 'RE-2026-0001' };
    expect(() => convertOfferToInvoice(invoice, 'RE-2026-0002')).toThrow('Nur Angebote können konvertiert werden');
  });

  it("Steuermode wird aus dem Angebot übernommen", () => {
    const offer = { type: 'offer', invoiceNumber: 'ANG-2026-0001', taxMode: 'kleinunternehmer' };
    const result = convertOfferToInvoice(offer, 'RE-2026-0001');
    expect(result.taxMode).toBe('kleinunternehmer');
  });
});
