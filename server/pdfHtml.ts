/**
 * Baut das vollständige HTML für ein Rechnungs-/Bestell-Dokument.
 * Wird von der Puppeteer-PDF-Generierung verwendet.
 */

function formatDateDE(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Versuche YYYY-MM-DD direkt zu parsen
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
  const docTitle = TYPE_LABELS[inv.type] ?? inv.type;
  const recipientLabel = isPurchaseOrder ? 'LIEFERANT' : 'EMPFÄNGER';

  const taxModeNote = inv.taxMode === 'kleinunternehmer'
    ? '<p style="margin-top:16px;font-size:11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>'
    : '';

  const items: any[] = inv.items ?? [];
  const optItems = items.filter((i: any) => i.isOptional);
  // Alle Positionen in die Gesamtsumme einrechnen (auch optionale)
  const pdfNet = items.reduce((s: number, i: any) => s + parseFloat(i.lineTotalNet ?? 0), 0);
  const pdfTax = items.reduce((s: number, i: any) => s + parseFloat(i.lineTax ?? 0), 0);
  const pdfGross = pdfNet + pdfTax;
  const pdfDiscount = items.reduce((s: number, i: any) => s + parseFloat(i.discountedNet ?? 0), 0);
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + '\u00a0€';

  const itemRows = items.map((it: any, i: number) => {
    const discountPct = parseFloat(it.discount ?? '0');
    const discountCell = discountPct > 0
      ? `<span style="color:#d97706;font-size:10px;"> (${discountPct}% Rabatt)</span>` : '';
    const optionalBadge = it.isOptional
      ? '<span style="background:#f3f4f6;color:#6b7280;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;">Optional</span>' : '';
    const longDesc = it.longDescription
      ? `<div style="font-size:10px;color:#555;margin-top:3px;white-space:pre-wrap;">${escHtml(it.longDescription)}</div>` : '';
    return `<tr style="${it.isOptional ? 'opacity:0.7;' : ''}">
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;">${i + 1}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;">
        <span style="font-weight:500;white-space:pre-wrap;">${escHtml(it.description ?? '')}</span>${optionalBadge}${discountCell}${longDesc}
      </td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${parseFloat(it.quantity ?? 1).toLocaleString('de-DE')}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;white-space:nowrap;">${escHtml(it.unit ?? 'Stk.')}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${parseFloat(it.unitPriceNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}\u00a0€</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${it.taxRate ?? 19}\u00a0%</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600;">${parseFloat(it.lineTotalNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}\u00a0€</td>
    </tr>`;
  }).join('');

  // Fußzeile: Bei Bestellungen kein footerCol4 (Bankdaten)
  const footerCols = isPurchaseOrder
    ? [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', '']
    : [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', cs?.footerCol4 ?? ''];
  const hasFooterCols = footerCols.some((c: string) => c.trim());
  const renderCol = (text: string) => text.split('\n')
    .map((l: string) => escHtml(l.replace(/https?:\/\//, '')))
    .join('<br>');

  // Empfänger-Block
  const recipientBlock = isPurchaseOrder
    ? `${inv.recipientCompany ? `<strong>${escHtml(inv.recipientCompany)}</strong><br>` : ''}${inv.recipientStreet ? escHtml(inv.recipientStreet) + '<br>' : ''}${(inv.recipientZip || inv.recipientCity) ? escHtml((inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '')) + '<br>' : ''}${inv.recipientCountry && inv.recipientCountry !== 'Deutschland' ? escHtml(inv.recipientCountry) : ''}`
    : `${inv.recipientCompany ? `<strong>${escHtml(inv.recipientCompany)}</strong><br>` : ''}${inv.recipientName && inv.recipientName !== inv.recipientCompany ? escHtml(inv.recipientName) + '<br>' : ''}${inv.recipientStreet ? escHtml(inv.recipientStreet) + '<br>' : ''}${(inv.recipientZip || inv.recipientCity) ? escHtml((inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '')) : ''}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${escHtml(inv.invoiceNumber ?? '')}</title>
<style>
  @page {
    size: A4;
    margin: 15mm 15mm 35mm 15mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    line-height: 1.5;
    background: #fff;
    position: relative;
  }
  table { width: 100%; border-collapse: collapse; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .doc-header-left { flex: 1; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px; }
  .doc-meta { font-size: 11px; color: #333; line-height: 1.8; }
  .sender-name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
  .sender-info { font-size: 10px; color: #444; line-height: 1.6; }
  .recipient-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .recipient-block { margin-bottom: 20px; }
  .divider { border: none; border-top: 1px solid #ddd; margin: 16px 0 28px 0; }
  .items-table th {
    background: #f0f0f0;
    text-align: left;
    padding: 6px;
    border-bottom: 2px solid #ccc;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .items-table td { padding: 5px 6px; border-bottom: 1px solid #e8e8e8; font-size: 11px; vertical-align: top; }
  .totals-section { display: flex; justify-content: flex-end; margin: 16px 0; }
  .totals-table { width: 280px; }
  .totals-table td { padding: 3px 6px; font-size: 11px; }
  .totals-table .total-row td { font-weight: 700; font-size: 13px; border-top: 2px solid #111; padding-top: 6px; }
  .payment-info { font-size: 10px; color: #333; margin-top: 8px; line-height: 1.8; }
  .notes { font-size: 10px; color: #555; margin-top: 12px; }

  /* Fußzeile: fixed am unteren Rand jeder Seite */
  .footer-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 28mm;
    border-top: 1.5px solid #bbb;
    padding-top: 6px;
    font-size: 9px;
    color: #555;
    background: #fff;
  }
  .footer-area table { width: 100%; }
  .footer-area table td { padding: 0 8px 0 0; vertical-align: top; font-size: 9px; color: #555; }

  .agb-page { page-break-before: always; padding-top: 8px; }
  .agb-page h2 { font-size: 15px; margin-bottom: 14px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  @media print {
    a { text-decoration: none; color: inherit; }
  }
</style>
</head>
<body>

<!-- KOPF -->
<div class="doc-header">
  <div class="doc-header-left">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:65px;max-width:200px;object-fit:contain;margin-bottom:10px;display:block;" crossorigin="anonymous">` : ''}
    <div class="sender-name">${escHtml(inv.senderName ?? '')}</div>
    <div class="sender-info">
      ${inv.senderStreet ? escHtml(inv.senderStreet) + '<br>' : ''}
      ${(inv.senderZip || inv.senderCity) ? escHtml((inv.senderZip ?? '') + ' ' + (inv.senderCity ?? '')) + '<br>' : ''}
      ${inv.senderEmail ? escHtml(inv.senderEmail) + '<br>' : ''}
      ${inv.senderPhone ? 'Tel. ' + escHtml(inv.senderPhone) + '<br>' : ''}
      ${inv.senderVatId ? 'USt-IdNr: ' + escHtml(inv.senderVatId) : ''}
    </div>
  </div>
  <div class="doc-header-right">
    <div class="doc-title">${escHtml(docTitle)}</div>
    <div class="doc-meta">
      <strong>Nr. ${escHtml(inv.invoiceNumber ?? '')}</strong><br>
      Datum: ${formatDateDE(inv.issueDate)}<br>
      ${inv.dueDate ? 'Fälligkeit: ' + formatDateDE(inv.dueDate) + '<br>' : ''}
      ${inv.deliveryDate ? 'Lieferdatum: ' + formatDateDE(inv.deliveryDate) : ''}
    </div>
  </div>
</div>

<!-- EMPFÄNGER / LIEFERANT -->
<div class="recipient-block">
  <div class="recipient-label">${recipientLabel}</div>
  <div style="font-size:11px;line-height:1.7;">${recipientBlock}</div>
</div>

<hr class="divider">

${inv.introText ? `<p style="margin-bottom:16px;font-size:11px;">${escHtml(inv.introText)}</p>` : ''}

<!-- POSITIONEN -->
<table class="items-table" style="margin-bottom:16px;">
  <thead><tr>
    <th style="width:4%;">#</th>
    <th>Beschreibung</th>
    <th style="text-align:right;width:8%;">Menge</th>
    <th style="width:7%;">Einheit</th>
    <th style="text-align:right;width:11%;">EP netto</th>
    <th style="text-align:right;width:8%;">MwSt</th>
    <th style="text-align:right;width:12%;">Gesamt netto</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- SUMMEN -->
<div class="totals-section">
  <table class="totals-table">
    ${pdfDiscount > 0 ? `<tr style="color:#c47a00;"><td>Rabatt gesamt:</td><td style="text-align:right">-${fmt(pdfDiscount)}</td></tr>` : ''}
    <tr><td style="color:#555;">Nettobetrag:</td><td style="text-align:right">${fmt(pdfNet)}</td></tr>
    <tr><td style="color:#555;">MwSt:</td><td style="text-align:right">${fmt(pdfTax)}</td></tr>
    <tr class="total-row"><td>Gesamtbetrag:</td><td style="text-align:right">${fmt(pdfGross)}</td></tr>

  </table>
</div>

${taxModeNote}

<!-- ZAHLUNGSINFOS -->
${!isPurchaseOrder && (inv.paymentTerms || inv.senderIban) ? `<div class="payment-info">
  ${inv.paymentTerms ? escHtml(inv.paymentTerms) + '<br>' : ''}
  ${inv.senderIban ? 'IBAN: ' + escHtml(inv.senderIban) + (inv.senderBic ? ' | BIC: ' + escHtml(inv.senderBic) : '') : ''}
</div>` : ''}

${inv.notes ? `<div class="notes">${escHtml(inv.notes)}</div>` : ''}
${inv.footerText ? `<p style="margin-top:16px;font-size:9px;color:#888;">${escHtml(inv.footerText)}</p>` : ''}

<!-- FUSSZEILE: fixed am unteren Rand -->
${hasFooterCols ? `<div class="footer-area">
  <table><tr>
    ${footerCols.map((c: string) => `<td style="width:25%;">${renderCol(c)}</td>`).join('')}
  </tr></table>
</div>` : ''}

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
