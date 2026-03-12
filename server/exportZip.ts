/**
 * ZIP-Export-Route — Notion-Stil
 * Erzeugt ein strukturiertes ZIP mit Ordnern, Markdown-Dateien und CSV-Übersichten
 */

import type { Express, Request, Response } from "express";
import archiver from "archiver";
import axios from "axios";
import { getFullExport } from "./db";

// ─── Typen ────────────────────────────────────────────────────────────────────
type ExportFormat = "markdown_csv" | "csv_only" | "json";

interface ExportOptions {
  format: ExportFormat;
  sections: string[]; // welche Bereiche exportieren
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function slugify(str: string): string {
  return (str ?? "unbekannt")
    .toLowerCase()
    .replace(/[äöüÄÖÜ]/g, c => ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue" }[c] ?? c))
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "unbekannt";
}

function formatDate(val: string | number | null | undefined): string {
  if (!val) return "";
  try {
    const d = typeof val === "number" ? new Date(val) : new Date(val);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return String(val);
  }
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(num) ? String(val) : `${num.toFixed(2)} €`;
}

/** Einfaches CSV aus Array of Objects */
function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => `"${c.label}"`).join(";");
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(";")
  );
  return [header, ...lines].join("\n");
}

// ─── Markdown-Generatoren ─────────────────────────────────────────────────────

function customerToMarkdown(c: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${c.name ?? "Unbekannt"}`,
    "",
    `**Firma:** ${c.company ?? "–"}`,
    `**Typ:** ${c.type ?? "–"}`,
    `**E-Mail:** ${c.email ?? "–"}`,
    `**Telefon:** ${c.phone ?? "–"}`,
    "",
    "## Adresse",
    `${c.street ?? "–"}  `,
    `${c.zip ?? ""} ${c.city ?? ""}  `,
    `${c.country ?? "Deutschland"}`,
    "",
  ];
  if (c.notes) {
    lines.push("## Notizen", "", String(c.notes), "");
  }
  lines.push(
    "---",
    `*Erstellt: ${formatDate(c.createdAt as string)}*`,
    `*Zuletzt geändert: ${formatDate(c.updatedAt as string)}*`,
  );
  return lines.join("\n");
}

function projectToMarkdown(p: Record<string, unknown>): string {
  const statusMap: Record<string, string> = {
    inquiry: "Anfrage", planning: "Planung", in_progress: "In Bearbeitung",
    review: "Prüfung", completed: "Abgeschlossen", cancelled: "Storniert",
  };
  const lines: string[] = [
    `# ${p.title ?? "Unbekannt"} (${p.projectNumber ?? ""})`,
    "",
    `**Status:** ${statusMap[p.status as string] ?? p.status ?? "–"}`,
    `**Priorität:** ${p.priority ?? "–"}`,
    `**Kunde:** ${p.customerId ? `Kunden-ID ${p.customerId}` : "–"}`,
    `**Startdatum:** ${formatDate(p.startDate as string)}`,
    `**Fälligkeitsdatum:** ${formatDate(p.dueDate as string)}`,
    `**Budget:** ${formatCurrency(p.budget as number)}`,
    `**Tatsächliche Kosten:** ${formatCurrency(p.actualCost as number)}`,
    "",
  ];
  if (p.description) lines.push("## Beschreibung", "", String(p.description), "");
  if (p.notes) lines.push("## Notizen", "", String(p.notes), "");
  lines.push(
    "---",
    `*Erstellt: ${formatDate(p.createdAt as string)}*`,
  );
  return lines.join("\n");
}

function invoiceToMarkdown(inv: Record<string, unknown>, items: Record<string, unknown>[]): string {
  const typeMap: Record<string, string> = { offer: "Angebot", invoice: "Rechnung", credit_note: "Gutschrift" };
  const statusMap: Record<string, string> = {
    draft: "Entwurf", sent: "Versendet", accepted: "Akzeptiert",
    invoiced: "Berechnet", paid: "Bezahlt", cancelled: "Storniert", overdue: "Überfällig",
  };
  const lines: string[] = [
    `# ${typeMap[inv.type as string] ?? inv.type} ${inv.invoiceNumber ?? ""}`,
    "",
    `**Typ:** ${typeMap[inv.type as string] ?? inv.type ?? "–"}`,
    `**Status:** ${statusMap[inv.status as string] ?? inv.status ?? "–"}`,
    `**Datum:** ${inv.issueDate ?? "–"}`,
    `**Fällig am:** ${inv.dueDate ?? "–"}`,
    "",
    "## Empfänger",
    `${inv.recipientName ?? "–"}  `,
    inv.recipientCompany ? `${inv.recipientCompany}  ` : "",
    `${inv.recipientStreet ?? ""}  `,
    `${inv.recipientZip ?? ""} ${inv.recipientCity ?? ""}`,
    "",
  ];
  if (inv.introText) lines.push("## Einleitungstext", "", String(inv.introText), "");
  if (items.length > 0) {
    lines.push("## Positionen", "");
    lines.push("| Pos. | Beschreibung | Menge | Einheit | Einzelpreis | Gesamt (netto) |");
    lines.push("|------|-------------|-------|---------|-------------|----------------|");
    for (const item of items) {
      lines.push(
        `| ${item.position ?? ""} | ${String(item.description ?? "").replace(/\n/g, " ")} | ${item.quantity ?? ""} | ${item.unit ?? ""} | ${formatCurrency(item.unitPriceNet as number)} | ${formatCurrency(item.lineTotalNet as number)} |`
      );
    }
    lines.push("");
  }
  lines.push(
    "## Beträge",
    `**Netto:** ${formatCurrency(inv.subtotalNet as number)}`,
    `**MwSt.:** ${formatCurrency(inv.taxAmount as number)}`,
    `**Brutto:** ${formatCurrency(inv.totalGross as number)}`,
    "",
  );
  if (inv.notes) lines.push("## Notizen", "", String(inv.notes), "");
  lines.push(
    "---",
    `*Erstellt: ${formatDate(inv.createdAt as number)}*`,
  );
  return lines.join("\n");
}

function knowledgeToMarkdown(k: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${k.title ?? "Unbekannt"}`,
    "",
    `**Kategorie:** ${k.category ?? "–"}`,
    `**Tags:** ${Array.isArray(k.tags) ? k.tags.join(", ") : (k.tags ?? "–")}`,
    "",
    "## Inhalt",
    "",
    String(k.content ?? ""),
    "",
    "---",
    `*Erstellt: ${formatDate(k.createdAt as string)}*`,
  ];
  return lines.join("\n");
}

function materialToMarkdown(m: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${m.name ?? "Unbekannt"}`,
    "",
    `**Kategorie:** ${m.category ?? "–"}`,
    `**Hersteller:** ${m.manufacturer ?? "–"}`,
    `**Artikelnummer:** ${m.articleNumber ?? "–"}`,
    `**Einheit:** ${m.unit ?? "–"}`,
    `**Einkaufspreis:** ${formatCurrency(m.purchasePrice as number)}`,
    `**Verkaufspreis:** ${formatCurrency(m.sellingPrice as number)}`,
    `**Lagerbestand:** ${m.stockQuantity ?? "–"} ${m.unit ?? ""}`,
    "",
  ];
  if (m.description) lines.push("## Beschreibung", "", String(m.description), "");
  lines.push(
    "---",
    `*Erstellt: ${formatDate(m.createdAt as string)}*`,
  );
  return lines.join("\n");
}

function supplierToMarkdown(s: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${s.name ?? "Unbekannt"}`,
    "",
    `**Firma:** ${s.company ?? "–"}`,
    `**E-Mail:** ${s.email ?? "–"}`,
    `**Telefon:** ${s.phone ?? "–"}`,
    `**Website:** ${s.website ?? "–"}`,
    "",
    "## Adresse",
    `${s.street ?? "–"}  `,
    `${s.zip ?? ""} ${s.city ?? ""}  `,
    `${s.country ?? "Deutschland"}`,
    "",
  ];
  if (s.notes) lines.push("## Notizen", "", String(s.notes), "");
  lines.push("---", `*Erstellt: ${formatDate(s.createdAt as string)}*`);
  return lines.join("\n");
}

function noteToMarkdown(n: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${n.title ?? "Notiz"}`,
    "",
    `**Status:** ${n.status ?? "–"}`,
    `**Priorität:** ${n.priority ?? "–"}`,
    "",
    "## Inhalt",
    "",
    String(n.content ?? ""),
    "",
    "---",
    `*Erstellt: ${formatDate(n.createdAt as string)}*`,
  ];
  return lines.join("\n");
}

// ─── README ───────────────────────────────────────────────────────────────────

function buildReadme(data: Awaited<ReturnType<typeof getFullExport>>, allInvoices: Record<string, unknown>[], options: ExportOptions): string {
  const now = new Date().toLocaleString("de-DE");
  return [
    "# Fabrica ERP — Datensicherung",
    "",
    `**Exportiert am:** ${now}`,
    `**Format:** ${options.format === "markdown_csv" ? "Markdown + CSV" : options.format === "csv_only" ? "Nur CSV" : "JSON"}`,
    `**Exportierte Bereiche:** ${options.sections.join(", ")}`,
    "",
    "## Enthaltene Daten",
    "",
    `| Bereich | Anzahl Datensätze |`,
    `|---------|-------------------|`,
    `| Kunden | ${data.customers.length} |`,
    `| Projekte | ${data.projects.length} |`,
    `| Angebote & Rechnungen | ${allInvoices.length} |`,
    `| Wissensdatenbank | ${data.knowledge.length} |`,
    `| Materialien | ${data.materials.length} |`,
    `| Lieferanten | ${data.suppliers.length} |`,
    `| Notizen | ${data.quickNotes.length} |`,
    "",
    "## Ordnerstruktur",
    "",
    "```",
    "📁 Kunden/",
    "   📄 _übersicht.csv",
    "   📄 Kundenname.md",
    "📁 Projekte/",
    "   📄 _übersicht.csv",
    "   📄 Projekttitel.md",
    "📁 Angebote-Rechnungen/",
    "   📄 _übersicht.csv",
    "   📄 RE-2026-0001.md",
    "📁 Wissensdatenbank/",
    "   📄 _übersicht.csv",
    "   📄 Thema.md",
    "📁 Materialien/",
    "   📄 _übersicht.csv",
    "   📄 Materialname.md",
    "📁 Lieferanten/",
    "   📄 _übersicht.csv",
    "   📄 Lieferantenname.md",
    "📁 Notizen/",
    "   📄 _übersicht.csv",
    "   📄 Notiz.md",
    "```",
    "",
    "---",
    "*Erstellt mit Fabrica ERP*",
  ].join("\n");
}

// ─── Haupt-Export-Funktion ────────────────────────────────────────────────────

export function registerExportRoutes(app: Express): void {
  app.get("/api/export/zip", async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as ExportFormat) || "markdown_csv";
      const sectionsParam = req.query.sections as string;
      const sections = sectionsParam
        ? sectionsParam.split(",")
        : ["kunden", "projekte", "rechnungen", "wissensdatenbank", "materialien", "lieferanten", "notizen"];

      const data = await getFullExport();

      // Rechnungen und Positionen aus DB holen
      const { getDb } = await import("./db");
      const { invoices: invoicesTable, invoiceItems: invoiceItemsTable } = await import("../drizzle/schema");
      const db = await getDb();
      const allInvoices = db ? await db.select().from(invoicesTable) : [];
      const allInvoiceItems = db ? await db.select().from(invoiceItemsTable) : [];

      // Notizen aus DB holen
      const { notes: notesTable } = await import("../drizzle/schema");
      const allNotes = db ? await db.select().from(notesTable) : [];

      const options: ExportOptions = { format, sections };

      const exportDate = new Date().toISOString().slice(0, 10);
      const filename = `fabrica-erp-export-${exportDate}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", (err) => { throw err; });
      archive.pipe(res);

      // README
      archive.append(buildReadme(data, allInvoices, options), { name: "README.md" });

      // ─── JSON-Format ───────────────────────────────────────────────────────
      if (format === "json") {
        archive.append(
          JSON.stringify({ ...data, invoices: allInvoices, invoiceItems: allInvoiceItems, notes: allNotes }, null, 2),
          { name: "fabrica-erp-daten.json" }
        );
        await archive.finalize();
        return;
      }

      // ─── Kunden ────────────────────────────────────────────────────────────
      if (sections.includes("kunden")) {
        const csvCols = [
          { key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "company", label: "Firma" },
          { key: "type", label: "Typ" }, { key: "email", label: "E-Mail" }, { key: "phone", label: "Telefon" },
          { key: "city", label: "Ort" }, { key: "country", label: "Land" }, { key: "createdAt", label: "Erstellt" },
        ];
        archive.append(toCsv(data.customers as Record<string, unknown>[], csvCols), { name: "Kunden/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const c of data.customers) {
            const slug = slugify((c as any).name ?? "kunde");
            archive.append(customerToMarkdown(c as Record<string, unknown>), { name: `Kunden/${slug}.md` });
          }
        }
      }

      // ─── Projekte ──────────────────────────────────────────────────────────
      if (sections.includes("projekte")) {
        const csvCols = [
          { key: "projectNumber", label: "Projektnummer" }, { key: "title", label: "Titel" },
          { key: "status", label: "Status" }, { key: "priority", label: "Priorität" },
          { key: "customerId", label: "Kunden-ID" }, { key: "budget", label: "Budget" },
          { key: "actualCost", label: "Ist-Kosten" }, { key: "startDate", label: "Start" },
          { key: "dueDate", label: "Fällig" }, { key: "createdAt", label: "Erstellt" },
        ];
        archive.append(toCsv(data.projects as Record<string, unknown>[], csvCols), { name: "Projekte/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const p of data.projects) {
            const slug = slugify((p as any).title ?? "projekt");
            archive.append(projectToMarkdown(p as Record<string, unknown>), { name: `Projekte/${slug}.md` });
          }
        }
      }

      // ─── Angebote & Rechnungen ─────────────────────────────────────────────
      if (sections.includes("rechnungen")) {
        const csvCols = [
          { key: "invoiceNumber", label: "Nummer" }, { key: "type", label: "Typ" },
          { key: "status", label: "Status" }, { key: "recipientName", label: "Empfänger" },
          { key: "recipientCompany", label: "Firma" }, { key: "issueDate", label: "Datum" },
          { key: "dueDate", label: "Fällig" }, { key: "subtotalNet", label: "Netto" },
          { key: "taxAmount", label: "MwSt." }, { key: "totalGross", label: "Brutto" },
          { key: "currency", label: "Währung" },
        ];
        archive.append(toCsv(allInvoices as Record<string, unknown>[], csvCols), { name: "Angebote-Rechnungen/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const inv of allInvoices) {
            const items = allInvoiceItems.filter((i: any) => i.invoiceId === (inv as any).id);
            const slug = slugify((inv as any).invoiceNumber ?? "dokument");
            archive.append(
              invoiceToMarkdown(inv as Record<string, unknown>, items as Record<string, unknown>[]),
              { name: `Angebote-Rechnungen/${slug}.md` }
            );
          }
        }
      }

      // ─── Wissensdatenbank ──────────────────────────────────────────────────
      if (sections.includes("wissensdatenbank")) {
        const csvCols = [
          { key: "id", label: "ID" }, { key: "title", label: "Titel" },
          { key: "category", label: "Kategorie" }, { key: "tags", label: "Tags" },
          { key: "createdAt", label: "Erstellt" },
        ];
        archive.append(toCsv(data.knowledge as Record<string, unknown>[], csvCols), { name: "Wissensdatenbank/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const k of data.knowledge) {
            const slug = slugify((k as any).title ?? "eintrag");
            archive.append(knowledgeToMarkdown(k as Record<string, unknown>), { name: `Wissensdatenbank/${slug}.md` });
          }
        }
      }

      // ─── Materialien ───────────────────────────────────────────────────────
      if (sections.includes("materialien")) {
        const csvCols = [
          { key: "name", label: "Name" }, { key: "category", label: "Kategorie" },
          { key: "manufacturer", label: "Hersteller" }, { key: "articleNumber", label: "Artikelnummer" },
          { key: "unit", label: "Einheit" }, { key: "purchasePrice", label: "EK-Preis" },
          { key: "sellingPrice", label: "VK-Preis" }, { key: "stockQuantity", label: "Lagerbestand" },
        ];
        archive.append(toCsv(data.materials as Record<string, unknown>[], csvCols), { name: "Materialien/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const m of data.materials) {
            const slug = slugify((m as any).name ?? "material");
            archive.append(materialToMarkdown(m as Record<string, unknown>), { name: `Materialien/${slug}.md` });
          }
        }
      }

      // ─── Lieferanten ───────────────────────────────────────────────────────
      if (sections.includes("lieferanten")) {
        const csvCols = [
          { key: "name", label: "Name" }, { key: "company", label: "Firma" },
          { key: "email", label: "E-Mail" }, { key: "phone", label: "Telefon" },
          { key: "city", label: "Ort" }, { key: "country", label: "Land" },
          { key: "createdAt", label: "Erstellt" },
        ];
        archive.append(toCsv(data.suppliers as Record<string, unknown>[], csvCols), { name: "Lieferanten/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const s of data.suppliers) {
            const slug = slugify((s as any).name ?? "lieferant");
            archive.append(supplierToMarkdown(s as Record<string, unknown>), { name: `Lieferanten/${slug}.md` });
          }
        }
      }

      // ─── Notizen ───────────────────────────────────────────────────────────
      if (sections.includes("notizen")) {
        const csvCols = [
          { key: "title", label: "Titel" }, { key: "status", label: "Status" },
          { key: "priority", label: "Priorität" }, { key: "createdAt", label: "Erstellt" },
        ];
        const allNotesForCsv = [...allNotes, ...data.quickNotes.map((n: any) => ({ title: n.content?.slice(0, 60) ?? "Schnellnotiz", status: "aktiv", priority: "normal", createdAt: n.createdAt, content: n.content }))];
        archive.append(toCsv(allNotesForCsv as Record<string, unknown>[], csvCols), { name: "Notizen/_übersicht.csv" });
        if (format === "markdown_csv") {
          for (const n of allNotes) {
            const slug = slugify((n as any).title ?? "notiz");
            archive.append(noteToMarkdown(n as Record<string, unknown>), { name: `Notizen/${slug}.md` });
          }
          // Schnellnotizen als einzelne Datei
          if (data.quickNotes.length > 0) {
            const qnLines = ["# Schnellnotizen", ""];
            for (const qn of data.quickNotes) {
              qnLines.push(`## ${formatDate((qn as any).createdAt)}`, "", String((qn as any).content ?? ""), "");
            }
            archive.append(qnLines.join("\n"), { name: "Notizen/schnellnotizen.md" });
          }
        }
      }

      await archive.finalize();
    } catch (err) {
      console.error("[export/zip] Fehler:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Export fehlgeschlagen" });
      }
    }
  });

  // ─── Projekt-Backup-Route ────────────────────────────────────────────────────
  // GET /api/export/project/:id  → ZIP mit Notizen als .txt + alle Dokumente als echte Dateien
  app.get("/api/export/project/:id", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ error: "Ungültige Projekt-ID" });
        return;
      }

      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Keine Datenbankverbindung" });
        return;
      }

      const {
        projects: projectsTable,
        notes: notesTable,
        quickNotes: quickNotesTable,
        projectDocuments: projectDocumentsTable,
        cadFiles: cadFilesTable,
        suppliers: suppliersTable,
      } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Projektdaten laden
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) {
        res.status(404).json({ error: "Projekt nicht gefunden" });
        return;
      }

      // Notizen, Dokumente, CAD-Dateien laden
      const notes = await db.select().from(notesTable).where(eq(notesTable.projectId, projectId));
      const quickNotes = await db.select().from(quickNotesTable).where(eq(quickNotesTable.projectId, projectId));
      const documents = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.projectId, projectId));
      const cadFiles = await db.select().from(cadFilesTable).where(eq(cadFilesTable.projectId, projectId));
      const allSuppliers = await db.select().from(suppliersTable);

      const exportDate = new Date().toISOString().slice(0, 10);
      const projectSlug = slugify(project.title ?? `projekt-${projectId}`);
      const filename = `fabrica-backup_${projectSlug}_${exportDate}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", (err) => { throw err; });
      archive.pipe(res);

      const base = projectSlug;

      // ── Projekt-Info.txt ──────────────────────────────────────────────────────
      const statusMap: Record<string, string> = {
        inquiry: "Anfrage", calculation: "Kalkulation", offer: "Angebot",
        order: "Auftrag", production: "Produktion", shipping: "Versand",
        completed: "Abgeschlossen", cancelled: "Storniert",
      };
      const infoLines = [
        `Projekt: ${project.title ?? ""}`,
        `Projektnummer: ${project.projectNumber ?? ""}`,
        `Status: ${statusMap[project.status] ?? project.status ?? ""}`,
        `Fälligkeitsdatum: ${project.deadline ? formatDate(project.deadline) : ""}`,
        `Erstellt: ${formatDate(project.createdAt)}`,
        ``,
        `Beschreibung:`,
        project.notes ?? "(keine)",
        ``,
        `Interne Notizen:`,
        project.internalNotes ?? "(keine)",
        ``,
        `EK gesamt: ${formatCurrency(project.totalEk)}`,
        `VK gesamt: ${formatCurrency(project.totalVk)}`,
        `Marge: ${formatCurrency(project.totalMargin)}`,
        ``,
        `Exportiert am: ${new Date().toLocaleString("de-DE")}`,
        `Erstellt mit Fabrica ERP`,
      ];
      archive.append(infoLines.join("\n"), { name: `${base}/Projekt-Info.txt` });

      // ── Notizen als .txt ──────────────────────────────────────────────────────
      for (const note of notes) {
        const noteSlug = slugify(note.title ?? "notiz");
        const noteLines = [
          `Titel: ${note.title ?? ""}`,
          `Status: ${note.status ?? ""}`,
          `Priorität: ${note.priority ?? ""}`,
          `Erstellt: ${formatDate(note.createdAt)}`,
          ``,
          note.content ?? "",
        ];
        archive.append(noteLines.join("\n"), { name: `${base}/Notizen/${noteSlug}.txt` });
      }

      // Schnellnotizen als eine Datei
      if (quickNotes.length > 0) {
        const qnLines: string[] = [`Schnellnotizen für Projekt: ${project.title}`, ``];
        for (const qn of quickNotes) {
          qnLines.push(`[${formatDate(qn.createdAt)}] ${qn.source ?? ""}`);
          qnLines.push(qn.text ?? "");
          qnLines.push(``);
        }
        archive.append(qnLines.join("\n"), { name: `${base}/Notizen/schnellnotizen.txt` });
      }

      // ── Dokumente als echte Dateien ───────────────────────────────────────────
      const categoryNames: Record<string, string> = {
        supplier_offer: "Lieferantenangebote",
        nda: "Geheimhaltung",
        order: "Bestellungen",
        delivery_note: "Lieferscheine",
        invoice: "Eingangsrechnungen",
        contract: "Vertraege",
        drawing: "Zeichnungen",
        other: "Sonstiges",
      };

      for (const doc of documents) {
        try {
          const supplier = doc.supplierId ? allSuppliers.find((s: any) => s.id === doc.supplierId) : null;
          const supplierPrefix = supplier ? `${slugify((supplier as any).name)}_` : "";
          const catFolder = categoryNames[doc.category] ?? "Sonstiges";
          const safeName = `${supplierPrefix}${doc.filename}`;
          const resp = await axios.get(doc.fileUrl, { responseType: "arraybuffer", timeout: 30000 });
          archive.append(Buffer.from(resp.data), { name: `${base}/Dokumente/${catFolder}/${safeName}` });
        } catch (dlErr) {
          // Wenn Download fehlschlägt: Platzhalter-TXT
          archive.append(
            `Datei konnte nicht heruntergeladen werden.\nURL: ${doc.fileUrl}\nFehler: ${String(dlErr)}`,
            { name: `${base}/Dokumente/${doc.filename}.FEHLER.txt` }
          );
        }
      }

      // ── CAD-Dateien als echte Dateien ─────────────────────────────────────────
      for (const cad of cadFiles) {
        try {
          const resp = await axios.get(cad.fileUrl, { responseType: "arraybuffer", timeout: 30000 });
          const versionSuffix = cad.version && cad.version > 1 ? `_v${cad.version}` : "";
          const safeName = cad.filename.replace(/[/\\]/g, "_");
          archive.append(Buffer.from(resp.data), { name: `${base}/CAD-Daten/${safeName}${versionSuffix}` });
        } catch (dlErr) {
          archive.append(
            `Datei konnte nicht heruntergeladen werden.\nURL: ${cad.fileUrl}\nFehler: ${String(dlErr)}`,
            { name: `${base}/CAD-Daten/${cad.filename}.FEHLER.txt` }
          );
        }
      }

      await archive.finalize();
    } catch (err) {
      console.error("[export/project] Fehler:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Projekt-Export fehlgeschlagen" });
      }
    }
  });

  // GET /api/export/backup-all  → ZIP mit ALLEN Projekten + Kunden/Lieferanten als CSV
  app.get("/api/export/backup-all", async (_req: Request, res: Response) => {
    try {
      const { getDb } = await import("./db");
      const {
        projects: projectsTable,
        notes: notesTable,
        quickNotes: quickNotesTable,
        projectDocuments: projectDocumentsTable,
        cadFiles: cadFilesTable,
        customers: customersTable,
        suppliers: suppliersTable,
      } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB nicht verfügbar" }); return; }

      const [allProjects, allCustomers, allSuppliers] = await Promise.all([
        db.select().from(projectsTable),
        db.select().from(customersTable),
        db.select().from(suppliersTable),
      ]);

      const exportDate = new Date().toISOString().slice(0, 10);
      const filename = `fabrica-gesamt-backup_${exportDate}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", (err) => { throw err; });
      archive.pipe(res);

      const statusMap: Record<string, string> = {
        inquiry: "Anfrage", calculation: "Kalkulation", offer: "Angebot",
        order: "Auftrag", production: "Produktion", shipping: "Versand",
        completed: "Abgeschlossen", cancelled: "Storniert",
      };
      const categoryNames: Record<string, string> = {
        supplier_offer: "Lieferantenangebote", nda: "Geheimhaltung",
        order: "Bestellungen", delivery_note: "Lieferscheine",
        invoice: "Eingangsrechnungen", contract: "Vertraege",
        drawing: "Zeichnungen", other: "Sonstiges",
      };

      // ── Kunden als CSV
      const customerCsvLines = ["Name;Firma;E-Mail;Telefon;Straße;PLZ;Ort;Land"];
      for (const c of allCustomers) {
        customerCsvLines.push([
          c.name ?? "", c.company ?? "",
          c.email ?? "", c.phone ?? "", c.street ?? "", c.zip ?? "", c.city ?? "",
          c.country ?? "",
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));
      }
      archive.append(customerCsvLines.join("\n"), { name: "Kunden.csv" });

      // ── Lieferanten als CSV
      const supplierCsvLines = ["Name;E-Mail;Telefon;Straße;PLZ;Ort;Land;Bewertung;Fähigkeiten"];
      for (const s of allSuppliers) {
        supplierCsvLines.push([
          s.name ?? "", s.email ?? "", s.phone ?? "",
          s.street ?? "", s.zip ?? "", s.city ?? "", s.country ?? "",
          s.rating ?? "", s.capabilities ?? "",
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));
      }
      archive.append(supplierCsvLines.join("\n"), { name: "Lieferanten.csv" });

      // ── Projekte-Übersicht als CSV
      const projectCsvLines = ["Projektnummer;Titel;Status;Fälligkeit;EK;VK;Marge"];
      for (const p of allProjects) {
        projectCsvLines.push([
          p.projectNumber ?? "", p.title ?? "",
          statusMap[p.status ?? ""] ?? p.status ?? "",
          p.deadline ? formatDate(p.deadline) : "",
          formatCurrency(p.totalEk), formatCurrency(p.totalVk), formatCurrency(p.totalMargin),
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));
      }
      archive.append(projectCsvLines.join("\n"), { name: "Projekte-Uebersicht.csv" });

      // ── Jedes Projekt als eigener Ordner
      for (const project of allProjects) {
        const projectSlug = slugify(project.title ?? `projekt-${project.id}`);
        const base = `Projekte/${projectSlug}`;

        const infoLines = [
          `Projekt: ${project.title ?? ""}`,
          `Projektnummer: ${project.projectNumber ?? ""}`,
          `Status: ${statusMap[project.status ?? ""] ?? project.status ?? ""}`,
          `Fälligkeitsdatum: ${project.deadline ? formatDate(project.deadline) : ""}`,
          `Erstellt: ${formatDate(project.createdAt)}`,
          ``,
          `Beschreibung:`,
          project.notes ?? "(keine)",
          ``,
          `Interne Notizen:`,
          project.internalNotes ?? "(keine)",
          ``,
          `EK gesamt: ${formatCurrency(project.totalEk)}`,
          `VK gesamt: ${formatCurrency(project.totalVk)}`,
          `Marge: ${formatCurrency(project.totalMargin)}`,
          ``,
          `Exportiert am: ${new Date().toLocaleString("de-DE")}`,
          `Erstellt mit Fabrica ERP`,
        ];
        archive.append(infoLines.join("\n"), { name: `${base}/Projekt-Info.txt` });

        const [projNotes, projQuickNotes, projDocs, projCad] = await Promise.all([
          db.select().from(notesTable).where(eq(notesTable.projectId, project.id)),
          db.select().from(quickNotesTable).where(eq(quickNotesTable.projectId, project.id)),
          db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.projectId, project.id)),
          db.select().from(cadFilesTable).where(eq(cadFilesTable.projectId, project.id)),
        ]);

        for (const note of projNotes) {
          const noteSlug = slugify(note.title ?? "notiz");
          archive.append(
            [`Titel: ${note.title ?? ""}`, `Status: ${note.status ?? ""}`,
             `Priorität: ${note.priority ?? ""}`, `Erstellt: ${formatDate(note.createdAt)}`,
             ``, note.content ?? ""].join("\n"),
            { name: `${base}/Notizen/${noteSlug}.txt` }
          );
        }
        if (projQuickNotes.length > 0) {
          const qnLines: string[] = [`Schnellnotizen für: ${project.title}`, ``];
          for (const qn of projQuickNotes) {
            qnLines.push(`[${formatDate(qn.createdAt)}] ${qn.source ?? ""}`);
            qnLines.push(qn.text ?? "");
            qnLines.push(``);
          }
          archive.append(qnLines.join("\n"), { name: `${base}/Notizen/schnellnotizen.txt` });
        }

        for (const doc of projDocs) {
          try {
            const supplier = doc.supplierId ? allSuppliers.find(s => s.id === doc.supplierId) : null;
            const supplierPrefix = supplier ? `${slugify(supplier.name)}_` : "";
            const catFolder = categoryNames[doc.category] ?? "Sonstiges";
            const safeName = `${supplierPrefix}${doc.filename}`;
            const resp = await axios.get(doc.fileUrl, { responseType: "arraybuffer", timeout: 30000 });
            archive.append(Buffer.from(resp.data), { name: `${base}/Dokumente/${catFolder}/${safeName}` });
          } catch {
            archive.append(
              `Datei konnte nicht heruntergeladen werden.\nURL: ${doc.fileUrl}`,
              { name: `${base}/Dokumente/${doc.filename}.FEHLER.txt` }
            );
          }
        }

        for (const cad of projCad) {
          try {
            const resp = await axios.get(cad.fileUrl, { responseType: "arraybuffer", timeout: 30000 });
            const versionSuffix = cad.version && cad.version > 1 ? `_v${cad.version}` : "";
            const safeName = cad.filename.replace(/[\/\\]/g, "_");
            archive.append(Buffer.from(resp.data), { name: `${base}/CAD-Daten/${safeName}${versionSuffix}` });
          } catch {
            archive.append(
              `Datei konnte nicht heruntergeladen werden.\nURL: ${cad.fileUrl}`,
              { name: `${base}/CAD-Daten/${cad.filename}.FEHLER.txt` }
            );
          }
        }
      }

      await archive.finalize();
    } catch (err) {
      console.error("[export/backup-all] Fehler:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Gesamt-Backup fehlgeschlagen" });
      }
    }
  });
}
