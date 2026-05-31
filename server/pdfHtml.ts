/**
 * Baut das vollständige HTML für ein Rechnungs-/Bestell-Dokument.
 * Layout nach Vorlage RE-1938:
 *  - Logo oben RECHTS (groß)
 *  - Absenderzeile klein, grau, links unter dem Logo-Bereich
 *  - Empfängeradresse links | Rechnungsinfo rechts (nebeneinander, mit Abstand)
 *  - Positionstabelle, Summen, Footer
 */

function formatDateDE(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
  }
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TYPE_LABELS: Record<string, string> = {
  invoice: 'Rechnung',
  offer: 'Angebot',
  credit_note: 'Gutschrift',
  order_confirmation: 'Auftragsbestätigung',
  purchase_order: 'Bestellung',
};

export function buildInvoiceHtml(inv: any, cs: any): string {
  const isPurchaseOrder = inv.type === 'purchase_order';
  const agbText: string = (cs?.agbText ?? '').trim();
  const logoUrl: string = cs?.logoUrl ?? '';
  const isCancelledInvoice = inv.type === 'invoice' && inv.status === 'cancelled';
  const docTitle = isCancelledInvoice ? 'Stornorechnung' : (TYPE_LABELS[inv.type] ?? inv.type);

  const taxModeNote = inv.taxMode === 'kleinunternehmer'
    ? '<p style="margin-top:16px;font-size:11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>'
    : '';

  const items: any[] = inv.items ?? [];
  const pdfNet = items.reduce((s: number, i: any) => s + parseFloat(i.lineTotalNet ?? 0), 0);
  const pdfTax = items.reduce((s: number, i: any) => s + parseFloat(i.lineTax ?? 0), 0);
  const pdfGross = pdfNet + pdfTax;
  const pdfDiscount = items.reduce((s: number, i: any) => s + parseFloat(i.discountedNet ?? 0), 0);
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + '\u00a0EUR';

  const itemRows = items.map((it: any, i: number) => {
    const discountPct = parseFloat(it.discount ?? '0');
    const discountCell = discountPct > 0
      ? `<span style="color:#d97706;font-size:10px;"> (${discountPct}% Rabatt)</span>` : '';
    const optionalBadge = it.isOptional
      ? '<span style="background:#f3f4f6;color:#6b7280;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;">Optional</span>' : '';
    const longDesc = it.longDescription
      ? `<div style="font-size:10px;color:#555;margin-top:3px;white-space:pre-wrap;">${escHtml(it.longDescription)}</div>` : '';
    return `<tr>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;${it.isOptional ? 'opacity:0.7;' : ''}">${i + 1}.</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;${it.isOptional ? 'opacity:0.7;' : ''}">
        <span style="font-weight:600;">${escHtml(it.description ?? '')}</span>${optionalBadge}${discountCell}${longDesc}
      </td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${parseFloat(it.quantity ?? 1).toLocaleString('de-DE')}&nbsp;${escHtml(it.unit ?? 'Stk.')}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${parseFloat(it.unitPriceNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}&nbsp;EUR</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${it.taxRate ?? 19}&nbsp;%</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600;">${parseFloat(it.lineTotalNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}&nbsp;EUR</td>
    </tr>`;
  }).join('');

  // Footer-Spalten
  const footerCols = isPurchaseOrder
    ? [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', '']
    : [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', cs?.footerCol4 ?? ''];
  const hasFooterCols = footerCols.some((c: string) => c.trim());
  const renderCol = (text: string) => text.split('\n')
    .map((l: string) => escHtml(l.replace(/https?:\/\//, '')))
    .join('<br>');

  // Absender-Kurzzeile (kleine graue Zeile über der Empfängeradresse)
  const senderLine = [inv.senderName, inv.senderStreet, `${inv.senderZip ?? ''} ${inv.senderCity ?? ''}`.trim()]
    .filter(Boolean).map(escHtml).join(' \u00b7 ');

  // Empfänger-Block (links)
  const recipientBlock = isPurchaseOrder
    ? `${inv.recipientCompany ? `<strong>${escHtml(inv.recipientCompany)}</strong><br>` : ''}${inv.recipientName && inv.recipientName !== inv.recipientCompany ? escHtml(inv.recipientName) + '<br>' : ''}${inv.recipientStreet ? escHtml(inv.recipientStreet) + '<br>' : ''}${(inv.recipientZip || inv.recipientCity) ? escHtml((inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '')) + '<br>' : ''}${inv.recipientCountry && inv.recipientCountry !== 'Deutschland' ? escHtml(inv.recipientCountry) : ''}`
    : `${inv.recipientCompany ? `<strong>${escHtml(inv.recipientCompany)}</strong><br>` : ''}${inv.recipientName && inv.recipientName !== inv.recipientCompany ? escHtml(inv.recipientName) + '<br>' : ''}${inv.recipientStreet ? escHtml(inv.recipientStreet) + '<br>' : ''}${(inv.recipientZip || inv.recipientCity) ? escHtml((inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '')) + '<br>' : ''}${inv.recipientCountry && inv.recipientCountry !== 'Deutschland' ? escHtml(inv.recipientCountry) : ''}`;

  // Rechnungsinfo-Block (rechts neben der Adresse)
  const metaRows = [
    { label: 'Rechnungs-Nr.', value: inv.invoiceNumber ?? '' },
    { label: 'Rechnungsdatum', value: formatDateDE(inv.issueDate) },
    inv.dueDate ? { label: 'Fällig', value: formatDateDE(inv.dueDate) } : null,
    inv.deliveryDate ? { label: 'Lieferdatum', value: formatDateDE(inv.deliveryDate) } : null,
    inv.customerNumber ? { label: 'Ihre Kundennummer', value: String(inv.customerNumber) } : null,
    inv.senderName ? { label: 'Ihr Ansprechpartner', value: escHtml(inv.senderName) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const metaTable = metaRows.map(r =>
    `<tr><td style="padding:2px 16px 2px 0;color:#555;white-space:nowrap;">${escHtml(r.label)}</td><td style="padding:2px 0;text-align:right;font-weight:500;white-space:nowrap;">${r.value}</td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${escHtml(inv.invoiceNumber ?? '')}</title>
<style>
  @page {
    size: A4;
    margin: 10mm 10mm 32mm 10mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    line-height: 1.5;
    background: #fff;
  }
  table { border-collapse: collapse; }

  /* ── KOPF-BEREICH ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0;
    min-height: 70px;
  }
  .page-header-left {
    /* leer – Platzhalter links */
    flex: 1;
  }
  .page-header-right {
    text-align: right;
    flex-shrink: 0;
  }
  .page-header-right img {
    max-height: 70px;
    max-width: 220px;
    object-fit: contain;
    display: block;
    margin-left: auto;
  }

  /* ── ABSENDER-KURZZEILE ── */
  .sender-line {
    font-size: 9px;
    color: #888;
    margin-top: 14px;
    margin-bottom: 6px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 5px;
  }

  /* ── ADRESS + META BEREICH ── */
  .address-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 10px;
    margin-bottom: 28px;
  }
  .address-block {
    font-size: 11px;
    line-height: 1.8;
    min-width: 200px;
  }
  .meta-block {
    font-size: 11px;
    text-align: right;
    flex-shrink: 0;
  }
  .meta-block table {
    margin-left: auto;
  }

  /* ── BETREFF ── */
  .doc-subject {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 6px;
    margin-top: 4px;
  }
  .doc-subject-nr {
    font-size: 11px;
    color: #555;
    margin-bottom: 18px;
  }

  /* ── TABELLE ── */
  .items-table {
    width: 100%;
    margin-bottom: 16px;
  }
  .items-table th {
    background: #f0f0f0;
    text-align: left;
    padding: 6px 6px;
    border-bottom: 2px solid #ccc;
    font-size: 10px;
    font-weight: 700;
  }
  .items-table th:not(:first-child):not(:nth-child(2)) {
    text-align: right;
  }
  .items-table td { font-size: 11px; vertical-align: top; }

  /* ── SUMMEN ── */
  .totals-section { display: flex; justify-content: flex-end; margin: 8px 0 16px 0; }
  .totals-table { width: 280px; }
  .totals-table td { padding: 3px 6px; font-size: 11px; }
  .totals-table .total-row td {
    font-weight: 700;
    font-size: 13px;
    border-top: 2px solid #111;
    padding-top: 6px;
  }

  /* ── ZAHLUNGSINFO ── */
  .payment-info { font-size: 10px; color: #333; margin-top: 8px; line-height: 1.8; }
  .notes { font-size: 10px; color: #555; margin-top: 12px; }

  /* ── FUSSZEILE ── */
  .footer-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 26mm;
    border-top: 1px solid #bbb;
    padding-top: 5px;
    font-size: 9px;
    color: #555;
    background: #fff;
  }
  .footer-area table { width: 100%; }
  .footer-area table td { padding: 0 8px 0 0; vertical-align: top; font-size: 9px; color: #555; }
  .footer-page-nr {
    position: fixed;
    bottom: 0;
    right: 0;
    font-size: 9px;
    color: #888;
    padding-bottom: 2px;
    padding-right: 2px;
  }

  /* ── AGB ── */
  .agb-page { page-break-before: always; padding-top: 8px; }
  .agb-page h2 { font-size: 15px; margin-bottom: 14px; border-bottom: 2px solid #333; padding-bottom: 8px; }

  @media print { a { text-decoration: none; color: inherit; } }
</style>
</head>
<body>

<!-- ══ KOPF: Logo rechts ══ -->
<div class="page-header">
  <div class="page-header-left"></div>
  <div class="page-header-right">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" crossorigin="anonymous">` : `<span style="font-size:18px;font-weight:700;">${escHtml(inv.senderName ?? '')}</span>`}
  </div>
</div>

<!-- ══ ABSENDER-KURZZEILE ══ -->
<div class="sender-line">${senderLine}</div>

<!-- ══ ADRESSE + RECHNUNGSINFO ══ -->
<div class="address-meta-row">
  <div class="address-block">
    ${recipientBlock}
  </div>
  <div class="meta-block">
    <table>
      ${metaTable}
    </table>
  </div>
</div>

<!-- ══ BETREFF ══ -->
<div class="doc-subject">${escHtml(docTitle)} Nr. ${escHtml(inv.invoiceNumber ?? '')}</div>
${isCancelledInvoice ? '<div style="font-size:11px;color:#cc0000;font-weight:600;margin-bottom:10px;margin-top:2px;">Dieses Dokument storniert die ursprüngliche Rechnung.</div>' : ''}
${(inv as any).subject ? `<div style="font-size:12px;font-weight:600;margin-bottom:12px;margin-top:4px;">Betreff: ${escHtml((inv as any).subject)}</div>` : ''}

${inv.introText ? `<p style="margin-bottom:16px;font-size:11px;">${escHtml(inv.introText)}</p>` : ''}

<!-- ══ POSITIONEN ══ -->
<table class="items-table">
  <thead><tr>
    <th style="width:4%;">Pos.</th>
    <th>Beschreibung</th>
    <th style="text-align:right;width:14%;">Menge</th>
    <th style="text-align:right;width:12%;">Einzelpreis</th>
    <th style="text-align:right;width:8%;">MwSt</th>
    <th style="text-align:right;width:13%;">Gesamtpreis</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- ══ SUMMEN ══ -->
<div class="totals-section">
  <table class="totals-table">
    ${pdfDiscount > 0 ? `<tr style="color:#c47a00;"><td>Rabatt gesamt:</td><td style="text-align:right">-${fmt(pdfDiscount)}</td></tr>` : ''}
    <tr><td style="color:#555;">Gesamtbetrag netto</td><td style="text-align:right">${fmt(pdfNet)}</td></tr>
    <tr><td style="color:#555;">Umsatzsteuer ${inv.taxMode === 'kleinunternehmer' ? '0' : '19'}%</td><td style="text-align:right">${fmt(pdfTax)}</td></tr>
    <tr class="total-row"><td>Gesamtbetrag brutto</td><td style="text-align:right${isCancelledInvoice ? ';color:#cc0000' : ''}">${isCancelledInvoice ? '−' : ''}${fmt(pdfGross)}</td></tr>
  </table>
</div>

${taxModeNote}

<!-- ══ ZAHLUNGSINFOS ══ -->
${!isPurchaseOrder && (inv.paymentTerms || inv.senderIban) ? `<div class="payment-info">
  ${inv.paymentTerms ? `<p style="margin-bottom:6px;">${escHtml(inv.paymentTerms)}</p>` : ''}
  ${inv.senderIban ? 'IBAN: ' + escHtml(inv.senderIban) + (inv.senderBic ? ' | BIC: ' + escHtml(inv.senderBic) : '') : ''}
</div>` : ''}

${inv.footerText ? `<p style="margin-top:16px;font-size:9px;color:#888;">${escHtml(inv.footerText)}</p>` : ''}

<!-- ══ FUSSZEILE ══ -->
${hasFooterCols ? `<div class="footer-area">
  <table><tr>
    ${footerCols.map((c: string) => `<td style="width:25%;">${renderCol(c)}</td>`).join('')}
  </tr></table>
</div>` : ''}

<!-- ══ AGB ══ -->
${agbText ? `<div class="agb-page">
  <h2>Allgemeine Geschäftsbedingungen</h2>
  <div style="white-space:pre-wrap;line-height:1.6;font-size:11px;">${escHtml(agbText)}</div>
</div>` : ''}

</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
