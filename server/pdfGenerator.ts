/**
 * PDF-Generator für Auftragsbestätigung
 * Nutzt WeasyPrint (Python) via child_process für HTML → PDF Konvertierung
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

export interface OrderConfirmationData {
  // Firmendaten
  companyName: string;
  companyStreet: string;
  companyZip: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyLogoUrl: string;
  vatId: string;
  taxNumber: string;
  iban: string;
  bic: string;
  bankName: string;
  footerCol1: string;
  footerCol2: string;
  footerCol3: string;
  footerCol4: string;
  // Kundendaten
  customerName: string;
  customerStreet?: string;
  customerZip?: string;
  customerCity?: string;
  customerCountry?: string;
  // Projektdaten
  projectTitle: string;
  projectNumber: string;
  issueDate: string;
  // Nachrichtentext
  bodyText: string;
  // Positionen
  items: Array<{
    name: string;
    quantity: number;
    unitVk: number;
    totalVk: number;
  }>;
  // Summen
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  kleinunternehmer: boolean;
}

function buildPdfHtml(data: OrderConfirmationData): string {
  const itemRows = data.items
    .map(
      (it, i) => `
    <tr>
      <td class="pos">${i + 1}</td>
      <td class="desc">${escHtml(it.name)}</td>
      <td class="num">${it.quantity.toLocaleString("de-DE")}</td>
      <td class="unit">Stk.</td>
      <td class="num">${it.unitVk.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
      <td class="num bold">${it.totalVk.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
    </tr>`
    )
    .join("");

  const taxRow = data.kleinunternehmer
    ? `<tr><td colspan="5" class="sum-label">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</td><td class="num">0,00 €</td></tr>`
    : `<tr><td colspan="5" class="sum-label">MwSt. ${data.taxRate}%:</td><td class="num">${data.taxAmount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td></tr>`;

  // Fußzeilen-Spalten (Zeilenumbrüche → <br>)
  const fmtFooter = (s: string) =>
    escHtml(s ?? "").replace(/\n/g, "<br>");

  const bodyHtml = escHtml(data.bodyText).replace(/\n/g, "<br>");

  // Empfängeradresse
  const addrLines = [
    data.customerName,
    data.customerStreet,
    data.customerZip && data.customerCity
      ? `${data.customerZip} ${data.customerCity}`
      : data.customerCity ?? data.customerZip,
    data.customerCountry && data.customerCountry !== "Deutschland"
      ? data.customerCountry
      : undefined,
  ]
    .filter(Boolean)
    .map(escHtml)
    .join("<br>");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 1cm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #111;
    background: #fff;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20pt;
  }
  .header-left img {
    max-height: 60pt;
    max-width: 180pt;
    object-fit: contain;
    display: block;
    margin-bottom: 6pt;
  }
  .header-left .company-info {
    font-size: 8.5pt;
    color: #444;
    line-height: 1.5;
  }
  .header-right {
    text-align: right;
    font-size: 8.5pt;
    color: #555;
    line-height: 1.6;
  }

  /* ── Absenderzeile (klein über Empfänger) ── */
  .sender-line {
    font-size: 7.5pt;
    color: #888;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2pt;
    margin-bottom: 4pt;
  }

  /* ── Empfängeradresse ── */
  .recipient {
    font-size: 10pt;
    line-height: 1.6;
    margin-bottom: 20pt;
    min-height: 50pt;
  }

  /* ── Titel ── */
  .doc-title {
    font-size: 16pt;
    font-weight: bold;
    border-bottom: 2pt solid #111;
    padding-bottom: 5pt;
    margin-bottom: 12pt;
  }

  /* ── Projektinfo ── */
  .project-info {
    font-size: 9.5pt;
    margin-bottom: 10pt;
    color: #333;
  }
  .project-info strong { color: #111; }

  /* ── Nachrichtentext ── */
  .body-text {
    font-size: 10pt;
    line-height: 1.6;
    margin-bottom: 16pt;
    color: #222;
  }

  /* ── Positionen-Tabelle ── */
  table.positions {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8pt;
    font-size: 9.5pt;
  }
  table.positions thead tr {
    background: #f0f0f0;
  }
  table.positions thead th {
    padding: 5pt 6pt;
    border-bottom: 1.5pt solid #bbb;
    text-align: left;
    font-weight: bold;
    font-size: 9pt;
  }
  table.positions thead th.num { text-align: right; }
  table.positions tbody td {
    padding: 5pt 6pt;
    border-bottom: 0.5pt solid #e5e5e5;
    vertical-align: top;
  }
  table.positions tbody td.pos { width: 22pt; color: #666; }
  table.positions tbody td.desc { width: auto; }
  table.positions tbody td.num { text-align: right; white-space: nowrap; }
  table.positions tbody td.unit { width: 28pt; color: #666; }
  table.positions tbody td.bold { font-weight: bold; }

  /* ── Summen ── */
  .sum-label { text-align: right; padding: 3pt 6pt; font-size: 9.5pt; }
  .sum-total td { font-weight: bold; font-size: 11pt; border-top: 1.5pt solid #111; }
  .sum-total td.num { padding: 5pt 6pt; }

  /* ── Fußzeile ── */
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-top: 0.5pt solid #ccc;
    padding-top: 5pt;
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #666;
    line-height: 1.5;
  }
  .footer-col { flex: 1; padding: 0 4pt; }
  .footer-col:first-child { padding-left: 0; }
  .footer-col:last-child { padding-right: 0; }

  /* ── Seitenzahl ── */
  .page-number {
    position: fixed;
    bottom: 0;
    right: 0;
    font-size: 7pt;
    color: #aaa;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-left">
    ${data.companyLogoUrl ? `<img src="${escHtml(data.companyLogoUrl)}" alt="Logo">` : ""}
    <div class="company-info">
      <strong>${escHtml(data.companyName)}</strong><br>
      ${escHtml(data.companyStreet)}<br>
      ${escHtml(data.companyZip)} ${escHtml(data.companyCity)}<br>
      ${escHtml(data.companyPhone)}<br>
      ${escHtml(data.companyEmail)}
    </div>
  </div>
  <div class="header-right">
    <strong>Datum:</strong> ${escHtml(data.issueDate)}<br>
    <strong>Projekt-Nr.:</strong> ${escHtml(data.projectNumber)}<br>
    <strong>USt.-ID:</strong> ${escHtml(data.vatId)}<br>
    <strong>Steuer-Nr.:</strong> ${escHtml(data.taxNumber)}
  </div>
</div>

<!-- Empfänger -->
<div class="recipient">
  <div class="sender-line">${escHtml(data.companyName)} · ${escHtml(data.companyStreet)} · ${escHtml(data.companyZip)} ${escHtml(data.companyCity)}</div>
  ${addrLines}
</div>

<!-- Dokumententitel -->
<div class="doc-title">Auftragsbestätigung</div>

<!-- Projektinfo -->
<div class="project-info">
  <strong>Projekt:</strong> ${escHtml(data.projectTitle)}
</div>

<!-- Nachrichtentext -->
<div class="body-text">${bodyHtml}</div>

<!-- Positionen -->
<table class="positions">
  <thead>
    <tr>
      <th style="width:22pt">#</th>
      <th>Bezeichnung</th>
      <th class="num" style="width:40pt">Menge</th>
      <th style="width:28pt">Einh.</th>
      <th class="num" style="width:70pt">Einzelpreis</th>
      <th class="num" style="width:70pt">Gesamt</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5" class="sum-label">Nettobetrag:</td>
      <td class="num" style="padding:3pt 6pt;">${data.netAmount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
    </tr>
    ${taxRow}
    <tr class="sum-total">
      <td colspan="5" class="sum-label" style="font-size:11pt;font-weight:bold;">Gesamtbetrag:</td>
      <td class="num">${data.grossAmount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
    </tr>
  </tfoot>
</table>

<!-- Fußzeile -->
<div class="footer">
  <div class="footer-col">${fmtFooter(data.footerCol1)}</div>
  <div class="footer-col">${fmtFooter(data.footerCol2)}</div>
  <div class="footer-col">${fmtFooter(data.footerCol3)}</div>
  <div class="footer-col">${fmtFooter(data.footerCol4)}</div>
</div>

</body>
</html>`;
}

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generiert ein PDF aus den Auftragsbestätigungs-Daten.
 * Gibt den PDF-Buffer zurück.
 */
export async function generateOrderConfirmationPdf(
  data: OrderConfirmationData
): Promise<Buffer> {
  const html = buildPdfHtml(data);

  // Temporäre Dateien
  const id = Date.now() + Math.random().toString(36).slice(2);
  const htmlPath = join(tmpdir(), `ab-${id}.html`);
  const pdfPath = join(tmpdir(), `ab-${id}.pdf`);

  try {
    await writeFile(htmlPath, html, "utf8");

    // WeasyPrint via Python aufrufen
    await execFileAsync("python3.11", [
      "-c",
      `import weasyprint; weasyprint.HTML(filename='${htmlPath}').write_pdf('${pdfPath}')`,
    ]);

    const pdfBuffer = await readFile(pdfPath);
    return pdfBuffer;
  } finally {
    // Temporäre Dateien aufräumen
    await unlink(htmlPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}
