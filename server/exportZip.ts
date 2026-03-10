/**
 * ZIP-Export-Route — Notion-Stil
 * Erzeugt ein strukturiertes ZIP mit Ordnern, Markdown-Dateien und CSV-Übersichten
 */

import type { Express, Request, Response } from "express";
import archiver from "archiver";
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
}
