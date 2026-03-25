/**
 * E-Rechnung Service – ZUGFeRD 2.3 / Factur-X (EN 16931 COMFORT-Profil)
 *
 * Erzeugt aus Rechnungsdaten ein PDF/A-3b mit eingebettetem ZUGFeRD-XML.
 * Pflicht für deutsche B2B-Rechnungen seit 01.01.2025 (§ 14 UStG).
 */

import { zugferd } from 'node-zugferd';
import { EN16931 } from 'node-zugferd/profile/en16931';

const invoicer = zugferd({ profile: EN16931 });

// ─── Typen ────────────────────────────────────────────────────────────────────

interface EInvoiceItem {
  position: number;
  description: string;
  quantity: string | number;
  unit: string;
  unitPriceNet: string | number;
  taxRate: string | number;
  lineTotalNet: string | number;
  lineTax: string | number;
  isOptional?: number;
}

interface EInvoiceData {
  invoiceNumber: string;
  invoiceType: string; // 'invoice' | 'credit_note' | 'offer' | 'purchase_order'
  issueDate: string;   // 'YYYY-MM-DD'
  dueDate?: string;
  deliveryDate?: string;
  currency: string;
  taxMode: string;
  subtotalNet: string | number;
  taxAmount: string | number;
  totalGross: string | number;
  paymentTerms?: string;
  // Absender (Verkäufer)
  sellerName: string;
  sellerStreet?: string;
  sellerZip?: string;
  sellerCity?: string;
  sellerCountry?: string;
  sellerEmail?: string;
  sellerTaxNumber?: string;
  sellerVatId?: string;
  sellerIban?: string;
  sellerBic?: string;
  sellerBankName?: string;
  // Empfänger (Käufer)
  buyerName: string;
  buyerStreet?: string;
  buyerZip?: string;
  buyerCity?: string;
  buyerCountry?: string;
  buyerEmail?: string;
  // Positionen (nur Pflichtpositionen)
  items: EInvoiceItem[];
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function toNum(v: string | number | undefined | null): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0;
}

function fmtDate(d: string | undefined): string {
  // Erwartet 'YYYY-MM-DD', gibt 'YYYYMMDD' zurück
  if (!d) return '';
  return d.replace(/-/g, '');
}

// UN/ECE Rec 20 Einheitencodes
function unitCode(unit: string): string {
  const map: Record<string, string> = {
    'Stk.': 'C62', 'Stück': 'C62', 'pcs': 'C62',
    'h': 'HUR', 'Std.': 'HUR', 'Stunden': 'HUR',
    'kg': 'KGM', 'g': 'GRM',
    'm': 'MTR', 'cm': 'CMT', 'mm': 'MMT',
    'm²': 'MTK', 'm³': 'MTQ',
    'l': 'LTR', 'ml': 'MLT',
    'Pauschal': 'LS', 'pauschal': 'LS', 'LS': 'LS',
    'Set': 'SET', 'Satz': 'SET',
    'Tag': 'DAY', 'Tage': 'DAY',
  };
  return map[unit] ?? 'C62';
}

// ZUGFeRD Dokumenttyp-Code
function documentTypeCode(invoiceType: string): string {
  switch (invoiceType) {
    case 'credit_note': return '381'; // Gutschrift
    case 'invoice':     return '380'; // Rechnung
    default:            return '380';
  }
}

// ─── XML generieren ───────────────────────────────────────────────────────────

export async function generateZugferdXml(data: EInvoiceData): Promise<string> {
  const isKleinunternehmer = data.taxMode === 'kleinunternehmer';

  // Nur Pflichtpositionen (isOptional === 0 oder undefined)
  const mandatoryItems = data.items.filter(i => !i.isOptional);

  // Steuersätze gruppieren für TaxBreakdown
  const taxGroups: Record<string, { net: number; tax: number; rate: number }> = {};
  for (const item of mandatoryItems) {
    const rate = toNum(item.taxRate);
    const key = String(rate);
    if (!taxGroups[key]) taxGroups[key] = { net: 0, tax: 0, rate };
    taxGroups[key].net += toNum(item.lineTotalNet);
    taxGroups[key].tax += toNum(item.lineTax);
  }

  const taxBreakdowns = Object.values(taxGroups).map(g => ({
    calculatedAmount: parseFloat(g.tax.toFixed(2)),
    typeCode: 'VAT' as const,
    basisAmount: parseFloat(g.net.toFixed(2)),
    rateApplicablePercent: g.rate,
    ...(isKleinunternehmer ? { exemptionReason: 'Umsatzsteuerbefreiung gemäß § 19 UStG (Kleinunternehmer)' } : {}),
  }));

  const schema: typeof invoicer.$Infer.Schema = {
    // Dokumentkopf
    documentInformation: {
      id: data.invoiceNumber,
      typeCode: documentTypeCode(data.invoiceType) as any,
      issueDateTime: {
        dateTimeString: {
          value: fmtDate(data.issueDate),
          format: '102',
        },
      },
      ...(data.invoiceType === 'credit_note' ? {} : {}),
    },

    // Verkäufer (Absender)
    seller: {
      name: data.sellerName,
      postalTradeAddress: {
        countryID: data.sellerCountry ?? 'DE',
        ...(data.sellerZip ? { postcodeCode: data.sellerZip } : {}),
        ...(data.sellerCity ? { cityName: data.sellerCity } : {}),
        ...(data.sellerStreet ? { lineOne: data.sellerStreet } : {}),
      },
      ...(data.sellerVatId ? {
        specifiedTaxRegistration: [{ id: { value: data.sellerVatId, schemeID: 'VA' } }],
      } : data.sellerTaxNumber ? {
        specifiedTaxRegistration: [{ id: { value: data.sellerTaxNumber, schemeID: 'FC' } }],
      } : {}),
      ...(data.sellerEmail ? {
        definedTradeContact: { emailURIUniversalCommunication: { uriid: data.sellerEmail } },
      } : {}),
    },

    // Käufer (Empfänger)
    buyer: {
      name: data.buyerName,
      postalTradeAddress: {
        countryID: data.buyerCountry ?? 'DE',
        ...(data.buyerZip ? { postcodeCode: data.buyerZip } : {}),
        ...(data.buyerCity ? { cityName: data.buyerCity } : {}),
        ...(data.buyerStreet ? { lineOne: data.buyerStreet } : {}),
      },
      ...(data.buyerEmail ? {
        definedTradeContact: { emailURIUniversalCommunication: { uriid: data.buyerEmail } },
      } : {}),
    },

    // Lieferdatum / Leistungszeitraum
    ...(data.deliveryDate ? {
      delivery: {
        actualDeliverySupplyChainEvent: {
          occurrenceDateTime: {
            dateTimeString: { value: fmtDate(data.deliveryDate), format: '102' },
          },
        },
      },
    } : {}),

    // Zahlungsbedingungen
    paymentTerms: {
      description: data.paymentTerms ?? 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
      ...(data.dueDate ? {
        dueDateDateTime: {
          dateTimeString: { value: fmtDate(data.dueDate), format: '102' },
        },
      } : {}),
    },

    // Bankverbindung
    ...(data.sellerIban ? {
      paymentMeans: {
        typeCode: '58' as any, // SEPA-Überweisung
        payeePartyCreditorFinancialAccount: { ibanId: data.sellerIban },
        ...(data.sellerBic ? {
          payeeSpecifiedCreditorFinancialInstitution: { bicId: data.sellerBic },
        } : {}),
      },
    } : {}),

    // Steueraufschlüsselung
    tradeTax: taxBreakdowns,

    // Gesamtbeträge
    monetarySummation: {
      lineTotalAmount: parseFloat(toNum(data.subtotalNet).toFixed(2)),
      taxBasisTotalAmount: parseFloat(toNum(data.subtotalNet).toFixed(2)),
      taxTotalAmount: parseFloat(toNum(data.taxAmount).toFixed(2)),
      grandTotalAmount: parseFloat(toNum(data.totalGross).toFixed(2)),
      duePayableAmount: parseFloat(toNum(data.totalGross).toFixed(2)),
    },

    // Positionen
    lineItems: mandatoryItems.map((item, idx) => ({
      lineId: String(idx + 1),
      product: { name: item.description },
      agreement: {
        netPriceProductTradePrice: {
          chargeAmount: toNum(item.unitPriceNet),
        },
      },
      delivery: {
        billedQuantity: {
          value: toNum(item.quantity),
          unitCode: unitCode(item.unit),
        },
      },
      settlement: {
        tradeTax: [{
          typeCode: 'VAT' as const,
          categoryCode: isKleinunternehmer ? 'E' as const : 'S' as const,
          rateApplicablePercent: toNum(item.taxRate),
        }],
        monetarySummation: {
          lineTotalAmount: toNum(item.lineTotalNet),
        },
      },
    })),
  };

  const invoice = invoicer.create(schema);
  return invoice.toXML();
}

// ─── XML in PDF einbetten (PDF/A-3b) ─────────────────────────────────────────

export async function embedZugferdInPdf(pdfBuffer: Buffer, data: EInvoiceData): Promise<Buffer> {
  const xml = await generateZugferdXml(data);
  const invoice = invoicer.create(await buildSchema(data));
  const pdfA = await invoice.embedInPdf(pdfBuffer, {
    metadata: {
      title: `${data.invoiceNumber} – ${data.sellerName}`,
    },
  });
  return Buffer.from(pdfA);
}

// Hilfsfunktion: Schema aus Daten bauen (für embedInPdf)
async function buildSchema(data: EInvoiceData): Promise<typeof invoicer.$Infer.Schema> {
  const isKleinunternehmer = data.taxMode === 'kleinunternehmer';
  const mandatoryItems = data.items.filter(i => !i.isOptional);

  const taxGroups: Record<string, { net: number; tax: number; rate: number }> = {};
  for (const item of mandatoryItems) {
    const rate = toNum(item.taxRate);
    const key = String(rate);
    if (!taxGroups[key]) taxGroups[key] = { net: 0, tax: 0, rate };
    taxGroups[key].net += toNum(item.lineTotalNet);
    taxGroups[key].tax += toNum(item.lineTax);
  }

  const taxBreakdowns = Object.values(taxGroups).map(g => ({
    calculatedAmount: parseFloat(g.tax.toFixed(2)),
    typeCode: 'VAT' as const,
    basisAmount: parseFloat(g.net.toFixed(2)),
    rateApplicablePercent: g.rate,
    ...(isKleinunternehmer ? { exemptionReason: 'Umsatzsteuerbefreiung gemäß § 19 UStG (Kleinunternehmer)' } : {}),
  }));

  return {
    documentInformation: {
      id: data.invoiceNumber,
      typeCode: documentTypeCode(data.invoiceType) as any,
      issueDateTime: {
        dateTimeString: { value: fmtDate(data.issueDate), format: '102' },
      },
    },
    seller: {
      name: data.sellerName,
      postalTradeAddress: {
        countryID: data.sellerCountry ?? 'DE',
        ...(data.sellerZip ? { postcodeCode: data.sellerZip } : {}),
        ...(data.sellerCity ? { cityName: data.sellerCity } : {}),
        ...(data.sellerStreet ? { lineOne: data.sellerStreet } : {}),
      },
      ...(data.sellerVatId ? {
        specifiedTaxRegistration: [{ id: { value: data.sellerVatId, schemeID: 'VA' } }],
      } : data.sellerTaxNumber ? {
        specifiedTaxRegistration: [{ id: { value: data.sellerTaxNumber, schemeID: 'FC' } }],
      } : {}),
    },
    buyer: {
      name: data.buyerName,
      postalTradeAddress: {
        countryID: data.buyerCountry ?? 'DE',
        ...(data.buyerZip ? { postcodeCode: data.buyerZip } : {}),
        ...(data.buyerCity ? { cityName: data.buyerCity } : {}),
        ...(data.buyerStreet ? { lineOne: data.buyerStreet } : {}),
      },
    },
    ...(data.deliveryDate ? {
      delivery: {
        actualDeliverySupplyChainEvent: {
          occurrenceDateTime: {
            dateTimeString: { value: fmtDate(data.deliveryDate), format: '102' },
          },
        },
      },
    } : {}),
    paymentTerms: {
      description: data.paymentTerms ?? 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
      ...(data.dueDate ? {
        dueDateDateTime: {
          dateTimeString: { value: fmtDate(data.dueDate), format: '102' },
        },
      } : {}),
    },
    ...(data.sellerIban ? {
      paymentMeans: {
        typeCode: '58' as any,
        payeePartyCreditorFinancialAccount: { ibanId: data.sellerIban },
        ...(data.sellerBic ? {
          payeeSpecifiedCreditorFinancialInstitution: { bicId: data.sellerBic },
        } : {}),
      },
    } : {}),
    tradeTax: taxBreakdowns,
    monetarySummation: {
      lineTotalAmount: parseFloat(toNum(data.subtotalNet).toFixed(2)),
      taxBasisTotalAmount: parseFloat(toNum(data.subtotalNet).toFixed(2)),
      taxTotalAmount: parseFloat(toNum(data.taxAmount).toFixed(2)),
      grandTotalAmount: parseFloat(toNum(data.totalGross).toFixed(2)),
      duePayableAmount: parseFloat(toNum(data.totalGross).toFixed(2)),
    },
    lineItems: mandatoryItems.map((item, idx) => ({
      lineId: String(idx + 1),
      product: { name: item.description },
      agreement: {
        netPriceProductTradePrice: {
          chargeAmount: toNum(item.unitPriceNet),
        },
      },
      delivery: {
        billedQuantity: {
          value: toNum(item.quantity),
          unitCode: unitCode(item.unit),
        },
      },
      settlement: {
        tradeTax: [{
          typeCode: 'VAT' as const,
          categoryCode: isKleinunternehmer ? 'E' as const : 'S' as const,
          rateApplicablePercent: toNum(item.taxRate),
        }],
        monetarySummation: {
          lineTotalAmount: toNum(item.lineTotalNet),
        },
      },
    })),
  };
}

// ─── Hauptfunktion: ZUGFeRD-PDF aus Rechnungsdaten ───────────────────────────

export async function buildEInvoiceData(inv: any, cs: any): Promise<EInvoiceData> {
  const issueDate = inv.issueDate ?? new Date().toISOString().slice(0, 10);
  return {
    invoiceNumber: inv.invoiceNumber ?? 'ENTWURF',
    invoiceType: inv.invoiceType ?? 'invoice',
    issueDate,
    dueDate: inv.dueDate ?? undefined,
    deliveryDate: inv.deliveryDate ?? undefined,
    currency: inv.currency ?? 'EUR',
    taxMode: inv.taxMode ?? 'standard',
    subtotalNet: inv.subtotalNet ?? '0.00',
    taxAmount: inv.taxAmount ?? '0.00',
    totalGross: inv.totalGross ?? '0.00',
    paymentTerms: inv.paymentTerms ?? undefined,
    // Verkäufer aus Unternehmenseinstellungen
    sellerName: cs?.name ?? 'Fabrica GmbH',
    sellerStreet: cs?.street ?? undefined,
    sellerZip: cs?.zip ?? undefined,
    sellerCity: cs?.city ?? undefined,
    sellerCountry: cs?.country ?? 'DE',
    sellerEmail: cs?.email ?? undefined,
    sellerTaxNumber: cs?.taxNumber ?? undefined,
    sellerVatId: cs?.vatId ?? undefined,
    sellerIban: cs?.iban ?? undefined,
    sellerBic: cs?.bic ?? undefined,
    sellerBankName: cs?.bankName ?? undefined,
    // Käufer aus Rechnungsempfänger
    buyerName: inv.recipientCompany || inv.recipientName || 'Unbekannt',
    buyerStreet: inv.recipientStreet ?? undefined,
    buyerZip: inv.recipientZip ?? undefined,
    buyerCity: inv.recipientCity ?? undefined,
    buyerCountry: 'DE',
    buyerEmail: inv.recipientEmail ?? undefined,
    // Positionen
    items: (inv.items ?? []).map((item: any) => ({
      position: item.position,
      description: item.description,
      quantity: item.quantity ?? '1',
      unit: item.unit ?? 'Stk.',
      unitPriceNet: item.unitPriceNet ?? '0.00',
      taxRate: item.taxRate ?? '19.00',
      lineTotalNet: item.lineTotalNet ?? '0.00',
      lineTax: item.lineTax ?? '0.00',
      isOptional: item.isOptional ?? 0,
    })),
  };
}
