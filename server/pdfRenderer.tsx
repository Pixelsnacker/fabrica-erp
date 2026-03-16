import React from 'react';
import {
  Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer';
import type { Invoice, InvoiceItem, CompanySettings } from '../drizzle/schema';

// ─── Typen ────────────────────────────────────────────────────────────────────
type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined): string {
  if (val == null) return '0,00';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(val: string | number | null | undefined): string {
  if (val == null) return '1';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  // Ganze Zahlen ohne Dezimalstellen
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    offer: 'Angebot',
    invoice: 'Rechnung',
    credit_note: 'Gutschrift',
    order_confirmation: 'Auftragsbestätigung',
    purchase_order: 'Bestellung',
    delivery_note: 'Lieferschein',
  };
  return labels[type] ?? type;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
    paddingTop: 28,
    paddingBottom: 55, // Platz für Fußzeile
    paddingLeft: 28,
    paddingRight: 28,
  },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  logo: { width: 108, height: 48, objectFit: 'contain' },
  companyBlock: { textAlign: 'right', fontSize: 8, color: '#555', lineHeight: 1.5 },

  // Absender-Zeile (klein über Empfänger)
  senderLine: { fontSize: 7, color: '#888', marginBottom: 3 },

  // Adressblock
  addressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  recipientBlock: { width: '55%' },
  recipientName: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  recipientText: { fontSize: 9, lineHeight: 1.5 },
  metaBlock: { width: '40%', textAlign: 'right' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  metaLabel: { fontSize: 8, color: '#666', marginRight: 4 },
  metaValue: { fontSize: 8, color: '#1a1a1a' },

  // Titel
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  docNumber: { fontSize: 9, color: '#555', marginBottom: 12 },

  // Intro-Text
  introText: { fontSize: 9, marginBottom: 10, lineHeight: 1.5 },

  // Tabelle
  tableHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderTopWidth: 0.5, borderTopColor: '#ccc', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: '#e0e0e0', paddingVertical: 4, paddingHorizontal: 4 },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: '#e0e0e0', paddingVertical: 4, paddingHorizontal: 4, backgroundColor: '#fafafa' },
  colPos: { width: '5%', fontSize: 8 },
  colDesc: { width: '42%', fontSize: 8, paddingRight: 4 },
  colQty: { width: '8%', fontSize: 8, textAlign: 'right' },
  colUnit: { width: '8%', fontSize: 8, textAlign: 'center' },
  colPrice: { width: '12%', fontSize: 8, textAlign: 'right' },
  colTax: { width: '8%', fontSize: 8, textAlign: 'center' },
  colTotal: { width: '17%', fontSize: 8, textAlign: 'right' },
  colHeaderText: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  longDesc: { fontSize: 7.5, color: '#555', marginTop: 2, lineHeight: 1.4 },
  optionalBadge: { fontSize: 7, color: '#888', marginTop: 1 },

  // Summen
  summaryBlock: { marginTop: 10, alignItems: 'flex-end' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  summaryLabel: { fontSize: 9, color: '#555', width: 100, textAlign: 'right', marginRight: 8 },
  summaryValue: { fontSize: 9, width: 70, textAlign: 'right' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 4 },
  summaryTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', width: 100, textAlign: 'right', marginRight: 8 },
  summaryTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', width: 70, textAlign: 'right' },

  // Notizen / Zahlungsbedingungen
  notesText: { fontSize: 8, color: '#555', marginTop: 12, lineHeight: 1.5 },
  paymentText: { fontSize: 8, color: '#555', marginTop: 6, lineHeight: 1.5 },

  // AGB-Seite
  agbPage: { paddingTop: 28, paddingBottom: 28, paddingLeft: 28, paddingRight: 28 },
  agbTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  agbText: { fontSize: 8, lineHeight: 1.6, color: '#333' },

  // Fußzeile (fixed am Seitenende)
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerCol: { width: '24%', fontSize: 6.5, color: '#666', lineHeight: 1.5 },
});

// ─── Komponenten ──────────────────────────────────────────────────────────────

function Footer({ cs, type }: { cs: CompanySettings | null; type: string }) {
  if (!cs) return null;
  const isPurchaseOrder = type === 'purchase_order';
  const col1 = cs.footerCol1 ?? '';
  const col2 = cs.footerCol2 ?? '';
  const col3 = cs.footerCol3 ?? '';
  const col4 = isPurchaseOrder ? '' : (cs.footerCol4 ?? '');
  if (!col1 && !col2 && !col3 && !col4) return null;
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerCol}>{col1}</Text>
      <Text style={S.footerCol}>{col2}</Text>
      <Text style={S.footerCol}>{col3}</Text>
      {!isPurchaseOrder && <Text style={S.footerCol}>{col4}</Text>}
    </View>
  );
}

function TableRow({ item, idx, isDeliveryNote }: { item: InvoiceItem; idx: number; isDeliveryNote?: boolean }) {
  const rowStyle = idx % 2 === 0 ? S.tableRow : S.tableRowAlt;
  if (isDeliveryNote) {
    return (
      <View style={rowStyle} wrap={false}>
        <Text style={S.colPos}>{item.position}</Text>
        <View style={{ width: '67%', fontSize: 8, paddingRight: 4 }}>
          <Text style={{ fontSize: 8 }}>{item.description}</Text>
          {item.longDescription ? <Text style={S.longDesc}>{item.longDescription}</Text> : null}
        </View>
        <Text style={{ width: '13%', fontSize: 8, textAlign: 'right' }}>{fmtQty(item.quantity)}</Text>
        <Text style={{ width: '15%', fontSize: 8, textAlign: 'center' }}>{item.unit ?? 'Stk.'}</Text>
      </View>
    );
  }
  return (
    <View style={rowStyle} wrap={false}>
      <Text style={S.colPos}>{item.position}</Text>
      <View style={S.colDesc}>
        <Text style={{ fontSize: 8 }}>{item.description}</Text>
        {item.longDescription ? <Text style={S.longDesc}>{item.longDescription}</Text> : null}
        {item.isOptional ? <Text style={S.optionalBadge}>(optional)</Text> : null}
      </View>
      <Text style={S.colQty}>{fmtQty(item.quantity)}</Text>
      <Text style={S.colUnit}>{item.unit ?? 'Stk.'}</Text>
      <Text style={S.colPrice}>{fmt(item.unitPriceNet)} €</Text>
      <Text style={S.colTax}>{fmt(item.taxRate)} %</Text>
      <Text style={S.colTotal}>{fmt(item.lineTotalGross)} €</Text>
    </View>
  );
}

// ─── Haupt-Dokument ───────────────────────────────────────────────────────────
export function InvoicePDF({ inv, cs }: { inv: InvoiceWithItems; cs: CompanySettings | null }) {
  const agbText = (cs?.agbText ?? '').trim();
  const hasAgb = agbText.length > 0 && inv.type !== 'purchase_order';

  // Empfänger-Adresse
  const recipientLines = [
    inv.recipientCompany,
    inv.recipientName,
    inv.recipientStreet,
    [inv.recipientZip, inv.recipientCity].filter(Boolean).join(' '),
  ].filter(Boolean);

  // Absender-Kurzzeile
  const senderShort = [cs?.name, cs?.street, [cs?.zip, cs?.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header: Logo + Firmenname */}
        <View style={S.headerRow}>
          {cs?.logoUrl ? (
            <Image style={S.logo} src={cs.logoUrl} />
          ) : (
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{cs?.name ?? ''}</Text>
          )}
          <View style={S.companyBlock}>
            <Text>{cs?.name ?? ''}</Text>
            <Text>{cs?.street ?? ''}</Text>
            <Text>{[cs?.zip, cs?.city].filter(Boolean).join(' ')}</Text>
          </View>
        </View>

        {/* Empfänger */}
        <View style={S.addressRow}>
          <View style={S.recipientBlock}>
            <Text style={S.senderLine}>{senderShort}</Text>
            {recipientLines.map((line, i) => (
              <Text key={i} style={i === 0 ? S.recipientName : S.recipientText}>{line}</Text>
            ))}
          </View>
          <View style={S.metaBlock}>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Datum:</Text>
              <Text style={S.metaValue}>{inv.issueDate ?? ''}</Text>
            </View>
            {inv.dueDate ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Fällig:</Text>
                <Text style={S.metaValue}>{inv.dueDate}</Text>
              </View>
            ) : null}
            {inv.deliveryDate ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Lieferdatum:</Text>
                <Text style={S.metaValue}>{inv.deliveryDate}</Text>
              </View>
            ) : null}
            {inv.customerId || inv.supplierId ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>{inv.supplierId ? 'Lieferant-Nr.:' : 'Kunden-Nr.:'}</Text>
                <Text style={S.metaValue}>{inv.supplierId ?? inv.customerId}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Dokumenttitel */}
        <Text style={S.docTitle}>{typeLabel(inv.type)}</Text>
        <Text style={S.docNumber}>{inv.invoiceNumber}</Text>

        {/* Intro-Text */}
        {inv.introText ? <Text style={S.introText}>{inv.introText}</Text> : null}

        {/* Positionen-Tabelle */}
        {inv.type === 'delivery_note' ? (
          <View style={S.tableHeader}>
            <Text style={[S.colPos, S.colHeaderText]}>#</Text>
            <Text style={[{ width: '67%', fontSize: 8 }, S.colHeaderText]}>Beschreibung</Text>
            <Text style={[{ width: '13%', fontSize: 8, textAlign: 'right' as const }, S.colHeaderText]}>Menge</Text>
            <Text style={[{ width: '15%', fontSize: 8, textAlign: 'center' as const }, S.colHeaderText]}>Einheit</Text>
          </View>
        ) : (
          <View style={S.tableHeader}>
            <Text style={[S.colPos, S.colHeaderText]}>#</Text>
            <Text style={[S.colDesc, S.colHeaderText]}>Beschreibung</Text>
            <Text style={[S.colQty, S.colHeaderText]}>Menge</Text>
            <Text style={[S.colUnit, S.colHeaderText]}>Einh.</Text>
            <Text style={[S.colPrice, S.colHeaderText]}>EP netto</Text>
            <Text style={[S.colTax, S.colHeaderText]}>MwSt</Text>
            <Text style={[S.colTotal, S.colHeaderText]}>Gesamt</Text>
          </View>
        )}
        {inv.items.map((item, idx) => (
          <TableRow key={item.id} item={item} idx={idx} isDeliveryNote={inv.type === 'delivery_note'} />
        ))}

        {/* Summen — bei Lieferschein ausblenden */}
        {inv.type !== 'delivery_note' ? (
          <View style={S.summaryBlock}>
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>Netto:</Text>
              <Text style={S.summaryValue}>{fmt(inv.subtotalNet)} €</Text>
            </View>
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>MwSt:</Text>
              <Text style={S.summaryValue}>{fmt(inv.taxAmount)} €</Text>
            </View>
            <View style={S.summaryTotalRow}>
              <Text style={S.summaryTotalLabel}>Gesamt (brutto):</Text>
              <Text style={S.summaryTotalValue}>{fmt(inv.totalGross)} €</Text>
            </View>
          </View>
        ) : null}

        {/* Notizen */}
        {inv.notes ? <Text style={S.notesText}>{inv.notes}</Text> : null}
        {inv.paymentTerms && inv.type !== 'purchase_order' ? <Text style={S.paymentText}>{inv.paymentTerms}</Text> : null}

        {/* Fußzeile */}
        <Footer cs={cs} type={inv.type} />
      </Page>

      {/* AGB-Seite */}
      {hasAgb ? (
        <Page size="A4" style={S.agbPage}>
          <Text style={S.agbTitle}>Allgemeine Geschäftsbedingungen</Text>
          <Text style={S.agbText}>{agbText}</Text>
        </Page>
      ) : null}
    </Document>
  );
}

// ─── Render-Funktion ──────────────────────────────────────────────────────────
export async function renderInvoicePdf(inv: InvoiceWithItems, cs: CompanySettings | null): Promise<Buffer> {
  const element = React.createElement(InvoicePDF, { inv, cs }) as any;
  const buf = await renderToBuffer(element);
  return Buffer.from(buf);
}
