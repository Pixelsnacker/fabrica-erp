/**
 * Einmal-Script: PDF für ein Angebot generieren und in Google Drive hochladen
 * Usage: node scripts/generateAndUploadPdf.mjs <invoice_id>
 */
import { createRequire } from 'module';
import { register } from 'tsx/esm/api';

// tsx für TypeScript-Imports registrieren
register();

const invoiceId = parseInt(process.argv[2] || '360001');
console.log(`Generiere PDF für Invoice ID: ${invoiceId}`);

// Dynamisch TypeScript-Module laden
const { getInvoiceById, getProjectById, getCustomerById, getCompanySettings } = await import('../server/db.ts');
const { renderInvoicePdf } = await import('../server/pdfRenderer.tsx');
const { uploadFileToDrive } = await import('../server/googleDrive.ts');

const inv = await getInvoiceById(invoiceId);
if (!inv) { console.error('Angebot nicht gefunden'); process.exit(1); }

console.log(`Angebot: ${inv.invoiceNumber}`);

const cs = await getCompanySettings();
const pdfBuffer = await renderInvoicePdf(inv, cs);
const filename = inv.invoiceNumber + '.pdf';
console.log(`PDF generiert: ${filename} (${pdfBuffer.length} bytes)`);

if (!inv.projectId) { console.error('Kein Projekt zugeordnet'); process.exit(1); }

const project = await getProjectById(inv.projectId);
const customer = project?.customerId ? await getCustomerById(project.customerId) : null;
const projectName = project?.projectNumber
  ? `${project.projectNumber} ${project.title}`.substring(0, 100)
  : (project?.title || 'Unbekannt').substring(0, 100);
const customerName = customer ? (customer.company || customer.name) : 'Unbekannt';

console.log(`Lade hoch für Kunde: ${customerName}, Projekt: ${projectName}`);

const result = await uploadFileToDrive({
  filename,
  mimeType: 'application/pdf',
  buffer: pdfBuffer,
  customerName,
  projectName,
});

console.log(`Drive-Upload erfolgreich! File ID: ${result.fileId}`);
console.log(`Drive URL: https://drive.google.com/file/d/${result.fileId}/view`);
process.exit(0);
