import React from 'react';
import {
  Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer';
import type { Invoice, InvoiceItem, CompanySettings } from '../drizzle/schema';

// Silbentrennung global deaktivieren
Font.registerHyphenationCallback((word) => [word]);

// ─── Typen ────────────────────────────────────────────────────────────────────
type InvoiceWithItems = Invoice & { items: InvoiceItem[]; recipientCustomerNumber?: number | null };

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined): string {
  if (val == null) return '0,00';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(val: string | number | null | undefined): string {
  if (val == null) return '1';
  const n = typeof val === 'string' ? parseFloat(val) : val;
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
    paddingBottom: 60,
    paddingLeft: 28,
    paddingRight: 28,
  },

  // ── Header: Logo rechts oben ──────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  logo: { width: 140, height: 65, objectFit: 'contain' },

  // ── QR-Code (rechts unter Logo) ───────────────────────────────────────────
  qrRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  qrCode: { width: 40, height: 40 },

  // ── Absender-Kurzzeile (einzeilig, klein, links) ──────────────────────────
  senderLine: {
    fontSize: 7,
    color: '#666',
    marginBottom: 6,
    borderBottomWidth: 0,
  },

  // ── Adress- und Metadaten-Block ───────────────────────────────────────────
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  recipientBlock: { width: '52%' },
  recipientCompany: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  recipientText: { fontSize: 9, lineHeight: 1.5 },

  // Metadaten-Tabelle rechts
  metaBlock: { width: '44%' },
  metaDocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  metaDocLabel: { fontSize: 10, color: '#333' },
  metaDocValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', textAlign: 'right' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: { fontSize: 8, color: '#555' },
  metaValue: { fontSize: 8, color: '#1a1a1a', textAlign: 'right' },
  metaDivider: { marginVertical: 4 },

  // ── Dokumenttitel ─────────────────────────────────────────────────────────
  docTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    marginTop: 4,
  },

  // ── Einleitungstext ───────────────────────────────────────────────────────
  introText: { fontSize: 9, marginBottom: 12, lineHeight: 1.5 },

  // ── Positionstabelle ──────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#999',
    borderBottomWidth: 0.5,
    borderBottomColor: '#999',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: '#ddd',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: '#ddd',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  colPos: { width: '6%', fontSize: 8 },
  colDesc: { width: '46%', fontSize: 8, paddingRight: 4 },
  colQty: { width: '14%', fontSize: 8, textAlign: 'right' },
  colPrice: { width: '17%', fontSize: 8, textAlign: 'right' },
  colTotal: { width: '17%', fontSize: 8, textAlign: 'right' },
  colHeaderText: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  longDesc: { fontSize: 7.5, color: '#555', marginTop: 2, lineHeight: 1.4 },
  optionalBadge: { fontSize: 7, color: '#888', marginTop: 1 },

  // ── Summenblock ───────────────────────────────────────────────────────────
  summaryBlock: { marginTop: 12, alignItems: 'flex-end' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  summaryLabel: { fontSize: 9, color: '#555', width: 170, textAlign: 'right', marginRight: 8 },
  summaryValue: { fontSize: 9, width: 80, textAlign: 'right' },
  summaryDivider: { width: 258, borderTopWidth: 0.5, borderTopColor: '#999', marginVertical: 4 },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  summaryTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 170, textAlign: 'right', marginRight: 8 },
  summaryTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 80, textAlign: 'right' },

  // ── Zahlungshinweis ───────────────────────────────────────────────────────
  paymentMethodLabel: { fontSize: 9, color: '#2563eb', marginTop: 14, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  paymentText: { fontSize: 9, color: '#333', lineHeight: 1.5 },

  // ── Notizen ───────────────────────────────────────────────────────────────
  notesText: { fontSize: 8.5, color: '#333', marginTop: 10, lineHeight: 1.5 },

  // ── Grußformel ────────────────────────────────────────────────────────────
  greetingBlock: { marginTop: 20, fontSize: 9, lineHeight: 1.6 },

  // ── Fußzeile (4 Spalten, fixed) ───────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    borderTopWidth: 0.5,
    borderTopColor: '#bbb',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerCol: { width: '24%', fontSize: 6.5, color: '#555', lineHeight: 1.5 },
  pageNumber: {
    position: 'absolute',
    bottom: 14,
    right: 28,
    fontSize: 7,
    color: '#888',
  },

  // ── AGB-Seite ─────────────────────────────────────────────────────────────
  agbPage: { paddingTop: 28, paddingBottom: 28, paddingLeft: 28, paddingRight: 28 },
  agbTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  agbText: { fontSize: 8, lineHeight: 1.6, color: '#333' },
});

// ─── Footer-Komponente ────────────────────────────────────────────────────────
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

// ─── Tabellenzeile ────────────────────────────────────────────────────────────
function TableRow({ item, idx, isDeliveryNote }: { item: InvoiceItem; idx: number; isDeliveryNote?: boolean }) {
  const rowStyle = S.tableRow; // kein Zebra-Muster wie in Vorlage
  if (isDeliveryNote) {
    return (
      <View style={rowStyle} wrap={false}>
        <Text style={S.colPos}>{item.position}</Text>
        <View style={{ width: '64%', fontSize: 8, paddingRight: 4 }}>
          <Text style={{ fontSize: 8 }}>{item.description}</Text>
          {item.longDescription ? <Text style={S.longDesc}>{item.longDescription}</Text> : null}
        </View>
        <Text style={{ width: '18%', fontSize: 8, textAlign: 'right' }}>{fmtQty(item.quantity)}&nbsp;{item.unit ?? 'Stk.'}</Text>
      </View>
    );
  }
  const totalDisplay = item.isOptional
    ? `(${fmt(item.lineTotalNet)} EUR)`
    : `${fmt(item.lineTotalNet)} EUR`;
  return (
    <View style={rowStyle} wrap={false}>
      <Text style={S.colPos}>{item.isOptional ? 'Opt.' : item.position}</Text>
      <View style={S.colDesc}>
        <Text style={{ fontSize: 8, fontFamily: item.isOptional ? 'Helvetica' : 'Helvetica-Bold' }}>{item.description}</Text>
        {item.longDescription ? <Text style={S.longDesc}>{item.longDescription}</Text> : null}
        {item.isOptional ? <Text style={S.optionalBadge}>(Optional)</Text> : null}
      </View>
      <Text style={S.colQty}>{fmtQty(item.quantity)}&nbsp;{item.unit ?? 'Stk.'}</Text>
      <Text style={S.colPrice}>{fmt(item.unitPriceNet)}&nbsp;EUR</Text>
      <Text style={S.colTotal}>{totalDisplay}</Text>
    </View>
  );
}

// ─── Haupt-Dokument ───────────────────────────────────────────────────────────
export function InvoicePDF({ inv, cs }: { inv: InvoiceWithItems; cs: CompanySettings | null }) {
  const agbText = (cs?.agbText ?? '').trim();
  const hasAgb = agbText.length > 0 && inv.type !== 'purchase_order';

  // Empfänger-Adresse aufbauen
  const recipientLines = [
    inv.recipientCompany,
    inv.recipientName,
    inv.recipientStreet,
    [inv.recipientZip, inv.recipientCity].filter(Boolean).join(' '),
  ].filter(Boolean);

  // Absender-Kurzzeile (einzeilig, Trennzeichen " · ")
  const senderShort = [
    cs?.name,
    cs?.street,
    [cs?.zip, cs?.city].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ');

  // Dokumenttitel
  const docTitle = `${typeLabel(inv.type)} Nr. ${inv.invoiceNumber}`;

  // Ansprechpartner aus company_settings (Name des Inhabers)
  const contactPerson = cs?.name ?? '';

  // Steuer-Zeile
  const taxRate = inv.taxMode === 'kleinunternehmer' || inv.taxMode === 'tax_free' ? 0 : 19;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Logo rechts oben ── */}
        <View style={S.headerRow}>
          {cs?.logoUrl ? (
            <Image style={S.logo} src={cs.logoUrl} />
          ) : (
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{cs?.name ?? ''}</Text>
          )}
        </View>

        {/* ── Absenderzeile einzeilig links ── */}
        <Text style={S.senderLine}>{senderShort}</Text>

        {/* ── Adress- und Metadaten-Block ── */}
        <View style={S.addressRow}>
          {/* Empfängeradresse links */}
          <View style={S.recipientBlock}>
            {recipientLines.map((line, i) => (
              <Text key={i} style={i === 0 ? S.recipientCompany : S.recipientText}>{line}</Text>
            ))}
          </View>

          {/* Metadaten-Tabelle rechts */}
          <View style={S.metaBlock}>
            {/* Dokumentnummer prominent */}
            <View style={S.metaDocRow}>
              <Text style={S.metaDocLabel}>
                {inv.type === 'offer' ? 'Angebots-Nr.' :
                 inv.type === 'invoice' ? 'Rechnungs-Nr.' :
                 inv.type === 'credit_note' ? 'Gutschrift-Nr.' :
                 inv.type === 'order_confirmation' ? 'Auftragsbestät.-Nr.' :
                 inv.type === 'purchase_order' ? 'Bestell-Nr.' :
                 'Lieferschein-Nr.'}
              </Text>
              <Text style={S.metaDocValue}>{inv.invoiceNumber}</Text>
            </View>

            {/* Datum */}
            {inv.issueDate ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>
                  {inv.type === 'offer' ? 'Angebotsdatum' :
                   inv.type === 'invoice' ? 'Rechnungsdatum' :
                   'Datum'}
                </Text>
                <Text style={S.metaValue}>{inv.issueDate}</Text>
              </View>
            ) : null}

            {/* Leistungszeitraum / Lieferdatum */}
            {inv.deliveryDate ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Leistungszeitraum</Text>
                <Text style={S.metaValue}>{inv.deliveryDate}</Text>
              </View>
            ) : null}

            {/* Fälligkeitsdatum */}
            {inv.dueDate && inv.type === 'invoice' ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Fällig bis</Text>
                <Text style={S.metaValue}>{inv.dueDate}</Text>
              </View>
            ) : null}

            {/* Trennzeile */}
            <View style={S.metaDivider} />

            {/* Kunden-Bestellnummer */}
            {(inv as any).customerOrderNumber ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Ihre Bestell-Nr.</Text>
                <Text style={S.metaValue}>{(inv as any).customerOrderNumber}</Text>
              </View>
            ) : null}

            {/* Kundennummer */}
            {inv.recipientCustomerNumber ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>{inv.supplierId ? 'Lieferant-Nr.' : 'Ihre Kundennummer'}</Text>
                <Text style={S.metaValue}>{inv.recipientCustomerNumber}</Text>
              </View>
            ) : null}

            {/* Ansprechpartner */}
            {contactPerson ? (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Ihr Ansprechpartner</Text>
                <Text style={S.metaValue}>{contactPerson}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Dokumenttitel ── */}
        <Text style={S.docTitle}>{docTitle}</Text>

        {/* ── Einleitungstext ── */}
        {inv.introText ? (
          <Text style={S.introText}>{inv.introText}</Text>
        ) : null}

        {/* ── Positionstabelle ── */}
        {inv.type === 'delivery_note' ? (
          <View style={S.tableHeader}>
            <Text style={[S.colPos, S.colHeaderText]}>Pos.</Text>
            <Text style={[{ width: '64%', fontSize: 8 }, S.colHeaderText]}>Beschreibung</Text>
            <Text style={[{ width: '18%', fontSize: 8, textAlign: 'right' as const }, S.colHeaderText]}>Menge</Text>
          </View>
        ) : (
          <View style={S.tableHeader}>
            <Text style={[S.colPos, S.colHeaderText]}>Pos.</Text>
            <Text style={[S.colDesc, S.colHeaderText]}>Beschreibung</Text>
            <Text style={[S.colQty, S.colHeaderText]}>Menge</Text>
            <Text style={[S.colPrice, S.colHeaderText]}>Einzelpreis</Text>
            <Text style={[S.colTotal, S.colHeaderText]}>Gesamtpreis</Text>
          </View>
        )}
        {inv.items.map((item, idx) => (
          <TableRow key={item.id} item={item} idx={idx} isDeliveryNote={inv.type === 'delivery_note'} />
        ))}

        {/* ── Summenblock (nicht bei Lieferschein) ── */}
        {inv.type !== 'delivery_note' ? (
          <View style={S.summaryBlock}>
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>Gesamtbetrag netto</Text>
              <Text style={S.summaryValue}>{fmt(inv.subtotalNet)} EUR</Text>
            </View>
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>
                {inv.taxMode === 'kleinunternehmer'
                  ? 'Keine MwSt. (§19 UStG)'
                  : inv.taxMode === 'tax_free'
                  ? 'Keine MwSt. (§4 UStG)'
                  : `Umsatzsteuer ${taxRate}%`}
              </Text>
              <Text style={S.summaryValue}>{fmt(inv.taxAmount)} EUR</Text>
            </View>
            <View style={S.summaryDivider} />
            <View style={S.summaryTotalRow}>
              <Text style={S.summaryTotalLabel}>Gesamtbetrag brutto</Text>
              <Text style={S.summaryTotalValue}>{fmt(inv.totalGross)} EUR</Text>
            </View>
            {/* Optionale Positionen */}
            {inv.items.some(i => i.isOptional) ? (
              <View style={[S.summaryRow, { marginTop: 6 }]}>
                <Text style={S.summaryLabel}>Summe optionaler Positionen netto</Text>
                <Text style={S.summaryValue}>
                  {fmt(String(inv.items.filter(i => i.isOptional).reduce((s, i) => s + (parseFloat(String(i.lineTotalNet ?? 0)) || 0), 0)))} EUR
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Zahlungsart ── */}
        {inv.paymentTerms && inv.type !== 'purchase_order' ? (
          <>
            {(inv.paymentTerms.toLowerCase().includes('paypal') ||
               inv.paymentTerms.toLowerCase().includes('überweisung') ||
               inv.paymentTerms.toLowerCase().includes('lastschrift')) ? (
              <Text style={S.paymentMethodLabel}>
                {inv.paymentTerms.toLowerCase().includes('paypal') ? 'PayPal' :
                 inv.paymentTerms.toLowerCase().includes('überweisung') ? 'Überweisung' :
                 'Lastschrift'}
              </Text>
            ) : null}
            <Text style={S.paymentText}>{inv.paymentTerms}</Text>
          </>
        ) : null}

        {/* ── Notizen ── */}
        {inv.notes ? <Text style={S.notesText}>{inv.notes}</Text> : null}

        {/* ── Grußformel ── */}
        <View style={S.greetingBlock}>
          <Text>Mit freundlichen Grüßen</Text>
          <Text>{cs?.name ?? ''}</Text>
        </View>

        {/* ── Fußzeile ── */}
        <Footer cs={cs} type={inv.type} />

        {/* ── Seitenzahl ── */}
        <Text
          style={S.pageNumber}
          render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
          fixed
        />
      </Page>

      {/* ── AGB-Seite ── */}
      {hasAgb ? (
        <Page size="A4" style={S.agbPage}>
          <Text style={S.agbTitle}>Allgemeine Geschäftsbedingungen</Text>
          <Text style={S.agbText}>{agbText}</Text>
          <Footer cs={cs} type={inv.type} />
          <Text
            style={S.pageNumber}
            render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
            fixed
          />
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
