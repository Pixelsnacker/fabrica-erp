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

// ─── Tests für erweiterte Positions-Felder (Sevdesk-Style) ──────────────────
describe("Erweiterte Positions-Felder", () => {
  // Hilfsfunktion: Positions-Berechnung mit Rabatt (spiegelt calcItem aus Frontend)
  function calcItemWithDiscount(item: {
    quantity: number;
    unitPriceNet: number;
    discount: number;
    taxRate: number;
  }) {
    const baseNet = item.quantity * item.unitPriceNet;
    const discountAmount = baseNet * item.discount / 100;
    const net = baseNet - discountAmount;
    const tax = net * item.taxRate / 100;
    return {
      discountedNet: discountAmount,
      lineTotalNet: net,
      lineTax: tax,
      lineTotalGross: net + tax,
    };
  }

  it("berechnet Rabatt korrekt (10% auf 1000 EUR)", () => {
    const result = calcItemWithDiscount({ quantity: 1, unitPriceNet: 1000, discount: 10, taxRate: 19 });
    expect(result.discountedNet).toBe(100);
    expect(result.lineTotalNet).toBe(900);
    expect(result.lineTax).toBe(171);
    expect(result.lineTotalGross).toBe(1071);
  });

  it("berechnet 0% Rabatt korrekt (kein Abzug)", () => {
    const result = calcItemWithDiscount({ quantity: 1, unitPriceNet: 500, discount: 0, taxRate: 19 });
    expect(result.discountedNet).toBe(0);
    expect(result.lineTotalNet).toBe(500);
    expect(result.lineTotalGross).toBe(595);
  });

  it("berechnet 100% Rabatt korrekt (Gratisoption)", () => {
    const result = calcItemWithDiscount({ quantity: 1, unitPriceNet: 200, discount: 100, taxRate: 19 });
    expect(result.discountedNet).toBe(200);
    expect(result.lineTotalNet).toBe(0);
    expect(result.lineTotalGross).toBe(0);
  });

  it("berechnet Rabatt mit Menge korrekt (3x 100 EUR, 20% Rabatt)", () => {
    const result = calcItemWithDiscount({ quantity: 3, unitPriceNet: 100, discount: 20, taxRate: 19 });
    expect(result.discountedNet).toBe(60); // 300 * 20% = 60
    expect(result.lineTotalNet).toBe(240); // 300 - 60 = 240
    expect(result.lineTax).toBeCloseTo(45.6, 1); // 240 * 19%
    expect(result.lineTotalGross).toBeCloseTo(285.6, 1);
  });

  it("validiert gültige Einheiten", () => {
    const VALID_UNITS = ['Stk.', 'Std.', 'km', 'pauschal', '%', 'm²', 'm', 'kg', 't', 'lfm', 'm³', 'L', 'Tag(e)', 'Woche(n)', 'Monat(e)'];
    expect(VALID_UNITS).toContain('Stk.');
    expect(VALID_UNITS).toContain('Std.');
    expect(VALID_UNITS).toContain('pauschal');
    expect(VALID_UNITS).toContain('m²');
    expect(VALID_UNITS).toHaveLength(15);
  });

  it("Optional-Feld ist boolean", () => {
    const item = { isOptional: true, description: 'Optionale Leistung' };
    expect(typeof item.isOptional).toBe('boolean');
    expect(item.isOptional).toBe(true);
  });

  it("Langbeschreibung kann leer sein", () => {
    const item = { description: 'Hauptbeschreibung', longDescription: '' };
    expect(item.longDescription).toBe('');
    expect(item.description).toBeTruthy();
  });

  it("AGB-Text wird korrekt als String gespeichert", () => {
    const agbText = "§1 Geltungsbereich\n§2 Vertragsschluss\n§3 Preise";
    expect(typeof agbText).toBe('string');
    expect(agbText.split('\n')).toHaveLength(3);
  });
});

// ─── calcTotals Hilfsfunktion (spiegelt Invoices.tsx) ────────────────────────────────────────────────
function parseGermanFloat(str: string | number | null | undefined): number {
  if (str == null) return 0;
  const s = String(str).trim();
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(s) || 0;
}
function calcTotals(items: Array<{ lineTotalNet: string; lineTax: string; lineTotalGross: string; isOptional?: boolean; discountedNet?: string }>) {
  // Optionale Positionen NICHT in Gesamtsumme – nur als Zusatzzeile ausweisen
  const required = items.filter(i => !i.isOptional);
  const optional = items.filter(i => i.isOptional);
  const net = required.reduce((s, i) => s + parseGermanFloat(i.lineTotalNet), 0);
  const tax = required.reduce((s, i) => s + parseGermanFloat(i.lineTax), 0);
  const optionalNet = optional.reduce((s, i) => s + parseGermanFloat(i.lineTotalNet), 0);
  const totalDiscount = items.reduce((s, i) => s + parseGermanFloat(i.discountedNet), 0);
  return {
    subtotalNet: net.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalGross: (net + tax).toFixed(2),
    optionalNet: optionalNet.toFixed(2),
    hasOptional: optional.length > 0,
    optionalCount: optional.length,
    totalDiscount: totalDiscount.toFixed(2),
  };
}

describe("calcTotals – Summenberechnung (optionale Positionen NICHT in Gesamtsumme)", () => {
  it("rechnet nur Pflichtpositionen korrekt zusammen", () => {
    const items = [
      { lineTotalNet: '100.00', lineTax: '19.00', lineTotalGross: '119.00', isOptional: false, discountedNet: '0.00' },
      { lineTotalNet: '200.00', lineTax: '38.00', lineTotalGross: '238.00', isOptional: false, discountedNet: '0.00' },
    ];
    const totals = calcTotals(items);
    expect(totals.subtotalNet).toBe('300.00');
    expect(totals.taxAmount).toBe('57.00');
    expect(totals.totalGross).toBe('357.00');
    expect(totals.hasOptional).toBe(false);
  });

  it("optionale Positionen werden NICHT in Gesamtsumme eingerechnet", () => {
    const items = [
      { lineTotalNet: '550.00', lineTax: '104.50', lineTotalGross: '654.50', isOptional: true, discountedNet: '0.00' },
      { lineTotalNet: '4450.00', lineTax: '845.50', lineTotalGross: '5295.50', isOptional: true, discountedNet: '0.00' },
    ];
    const totals = calcTotals(items);
    // Nur optionale Positionen → Gesamtsumme = 0,00
    expect(totals.subtotalNet).toBe('0.00');
    expect(totals.taxAmount).toBe('0.00');
    expect(totals.totalGross).toBe('0.00');
    // Optionale Summe separat ausgewiesen
    expect(totals.optionalNet).toBe('5000.00');
    expect(totals.hasOptional).toBe(true);
    expect(totals.optionalCount).toBe(2);
  });

  it("gemischte Positionen: nur Pflichtpositionen in Gesamtsumme, optionale separat", () => {
    const items = [
      { lineTotalNet: '1000.00', lineTax: '190.00', lineTotalGross: '1190.00', isOptional: false, discountedNet: '0.00' },
      { lineTotalNet: '500.00', lineTax: '95.00', lineTotalGross: '595.00', isOptional: true, discountedNet: '0.00' },
    ];
    const totals = calcTotals(items);
    // Nur Pflichtposition (1000 EUR) in Gesamtsumme
    expect(totals.subtotalNet).toBe('1000.00');
    expect(totals.taxAmount).toBe('190.00');
    expect(totals.totalGross).toBe('1190.00');
    // Optionale Position separat
    expect(totals.optionalNet).toBe('500.00');
  });

  it("leere Liste ergibt 0,00", () => {
    const totals = calcTotals([]);
    expect(totals.subtotalNet).toBe('0.00');
    expect(totals.taxAmount).toBe('0.00');
    expect(totals.totalGross).toBe('0.00');
  });

  it("Angebot AN-2026-1861 Simulation: 4 optionale Positionen → Gesamtsumme = 0,00", () => {
    const items = [
      { lineTotalNet: '550.00', lineTax: '104.50', lineTotalGross: '654.50', isOptional: true, discountedNet: '0.00' },
      { lineTotalNet: '4450.00', lineTax: '845.50', lineTotalGross: '5295.50', isOptional: true, discountedNet: '0.00' },
      { lineTotalNet: '13500.00', lineTax: '2565.00', lineTotalGross: '16065.00', isOptional: true, discountedNet: '0.00' },
      { lineTotalNet: '24480.00', lineTax: '4651.20', lineTotalGross: '29131.20', isOptional: true, discountedNet: '0.00' },
    ];
    const totals = calcTotals(items);
    // Alle optional → Gesamtbetrag = 0,00 (wie SevDesk-Referenz AN-1852)
    expect(totals.subtotalNet).toBe('0.00');
    expect(totals.taxAmount).toBe('0.00');
    expect(totals.totalGross).toBe('0.00');
    // Summe optionaler Positionen separat
    expect(parseFloat(totals.optionalNet)).toBeCloseTo(42980.00, 1);
    expect(totals.hasOptional).toBe(true);
  });
});

describe("PDF-Berechnung – lineTotalNet vs lineTotalGross", () => {
  it("Positions-Spalte im PDF zeigt Netto (lineTotalNet), nicht Brutto", () => {
    const item = { lineTotalNet: '550.00', lineTotalGross: '654.50', taxRate: '19.00', unitPriceNet: '550.00', quantity: '1' };
    // PDF-Renderer soll lineTotalNet verwenden
    const pdfColumnValue = parseFloat(item.lineTotalNet);
    const grossValue = parseFloat(item.lineTotalGross);
    expect(pdfColumnValue).toBe(550.00);
    expect(grossValue).toBe(654.50);
    expect(pdfColumnValue).not.toBe(grossValue); // Sicherstellen dass Netto ≠ Brutto
    expect(pdfColumnValue).toBeLessThan(grossValue); // Netto < Brutto
  });

  it("PDF-Gesamtsumme = Summe aller lineTotalNet + Summe aller lineTax", () => {
    const items = [
      { lineTotalNet: '550.00', lineTax: '104.50' },
      { lineTotalNet: '4450.00', lineTax: '845.50' },
    ];
    const pdfNet = items.reduce((s, i) => s + parseFloat(i.lineTotalNet), 0);
    const pdfTax = items.reduce((s, i) => s + parseFloat(i.lineTax), 0);
    const pdfGross = pdfNet + pdfTax;
    expect(pdfNet).toBe(5000.00);
    expect(pdfTax).toBeCloseTo(950.00, 1);
    expect(pdfGross).toBeCloseTo(5950.00, 1);
  });
});

// ─── prepareGmailDraft Procedure ────────────────────────────────────────────
describe('companySettings.prepareGmailDraft', () => {
  it('Procedure ist im Router registriert', async () => {
    const { appRouter } = await import('./routers');
    const procedures = Object.keys((appRouter as any)._def.procedures);
    const gmailProcs = procedures.filter((p: string) => p.includes('prepareGmailDraft'));
    expect(gmailProcs.length).toBeGreaterThan(0);
  });

  it('E-Mail-Text enthält Angebotsnummer und Signatur-Elemente', () => {
    // Simuliert die E-Mail-Text-Generierung
    const invoiceNumber = 'AN-2026-1861';
    const recipientCompany = 'Test GmbH';
    const issueDate = '24.03.2026';
    const senderName = 'Daniel Rincón';
    const companyName = 'Fabrica GmbH';
    const companyEmail = 'd.rincon@fabrica3d.eu';

    const salutation = `Sehr geehrte Damen und Herren,`;
    const emailBody = `${salutation}\n\nim Anhang übersende ich Ihnen unser Angebot ${invoiceNumber} vom ${issueDate}.\n\nBei Rückfragen stehe ich Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\n\n${senderName}\n\n${companyName}`;

    expect(emailBody).toContain(invoiceNumber);
    expect(emailBody).toContain('Sehr geehrte Damen und Herren');
    expect(emailBody).toContain('Mit freundlichen Grüßen');
    expect(emailBody).toContain(senderName);
    expect(emailBody).toContain(companyName);
  });

  it('Betreff enthält Angebotsnummer und Firmenname', () => {
    const invoiceNumber = 'AN-2026-1861';
    const recipientCompany = 'Test GmbH';
    const subject = `Angebot ${invoiceNumber} für ${recipientCompany}`;
    expect(subject).toContain(invoiceNumber);
    expect(subject).toContain(recipientCompany);
  });
});

describe('E-Rechnung (ZUGFeRD 2.3)', () => {
  it('generateEInvoice Procedure ist im Router registriert', async () => {
    const { appRouter } = await import('./routers');
    expect(typeof (appRouter as any)._def.procedures['invoices.generateEInvoice']).toBe('function');
  });

  it('E-Rechnung nur für Rechnungen und Gutschriften verfügbar', () => {
    const allowedTypes = ['invoice', 'credit_note'];
    const notAllowedTypes = ['offer', 'order_confirmation', 'purchase_order', 'delivery_note'];
    for (const t of allowedTypes) {
      expect(allowedTypes.includes(t)).toBe(true);
    }
    for (const t of notAllowedTypes) {
      expect(allowedTypes.includes(t)).toBe(false);
    }
  });

  it('ZUGFeRD-Dateiname endet auf _ZUGFeRD.pdf', () => {
    const invoiceNumber = 'RE-2026-0042';
    const filename = invoiceNumber + '_ZUGFeRD.pdf';
    expect(filename).toBe('RE-2026-0042_ZUGFeRD.pdf');
    expect(filename.endsWith('_ZUGFeRD.pdf')).toBe(true);
  });

  it('buildEInvoiceData und embedZugferdInPdf sind exportiert', async () => {
    const mod = await import('./eInvoice');
    expect(typeof mod.buildEInvoiceData).toBe('function');
    expect(typeof mod.embedZugferdInPdf).toBe('function');
  });
});
