/**
 * chatExportRouter.ts — Export-Prozeduren für Chat und Todos
 * Exportiert: Chatverlauf als PDF/CSV, Todo-Liste als PDF/CSV, Anhänge als ZIP
 * Bestandsschutz: Nur additive Ergänzungen, keine bestehenden Dateien verändert
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { projectChatMessages, projectTodos, projects, customers, projectPortalConfig } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import archiver from "archiver";
import axios from "axios";

const execFileAsync = promisify(execFile);

// ─── Logo-URL ─────────────────────────────────────────────────────────────────
const FABRICA_LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663031764330/YMZow7uQxpBVyBGbmbpvvd/FabricaLogoneu_096a1b04.png";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function escHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("de-DE", {
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateTime(ts: number): string {
  return `${fmtDate(ts)}, ${fmtTime(ts)}`;
}

function slugify(s: string): string {
  return s
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 60);
}

function todaySlug(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** HTML → PDF via WeasyPrint (gleiche Methode wie pdfGenerator.ts) */
async function htmlToPdf(html: string): Promise<Buffer> {
  const id = Date.now() + Math.random().toString(36).slice(2);
  const htmlPath = join(tmpdir(), `chat-export-${id}.html`);
  const pdfPath = join(tmpdir(), `chat-export-${id}.pdf`);
  try {
    await writeFile(htmlPath, html, "utf8");
    await execFileAsync("python3.11", [
      "-c",
      `import weasyprint; weasyprint.HTML(filename='${htmlPath}').write_pdf('${pdfPath}')`,
    ]);
    return await readFile(pdfPath);
  } finally {
    await unlink(htmlPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}

/** Gemeinsamer PDF-Header */
function buildPdfHeader(projectTitle: string, customerName: string, subtitle: string): string {
  return `
    <div class="header">
      <img src="${FABRICA_LOGO_URL}" alt="Fabrica 3D" class="logo" />
      <div class="header-info">
        <div class="project-title">${escHtml(projectTitle)}</div>
        <div class="customer-name">${escHtml(customerName)}</div>
        <div class="subtitle">${escHtml(subtitle)}</div>
      </div>
    </div>`;
}

/** Gemeinsame CSS-Basis */
function buildPdfStyles(): string {
  return `
    <style>
      @page { margin: 20mm 18mm; size: A4; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; margin: 0; }
      .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px; }
      .logo { height: 40px; object-fit: contain; }
      .header-info { flex: 1; }
      .project-title { font-size: 13pt; font-weight: bold; color: #111; }
      .customer-name { font-size: 10pt; color: #555; margin-top: 2px; }
      .subtitle { font-size: 9pt; color: #888; margin-top: 2px; }
      .section-title { font-size: 11pt; font-weight: bold; color: #374151; margin: 20px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      .msg { margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; background: #f9fafb; border-left: 3px solid #d1d5db; }
      .msg-erp { border-left-color: #6366f1; }
      .msg-customer { border-left-color: #10b981; }
      .msg-meta { font-size: 8pt; color: #6b7280; margin-bottom: 3px; }
      .msg-sender { font-weight: bold; color: #374151; }
      .msg-text { font-size: 10pt; white-space: pre-wrap; word-break: break-word; }
      .msg-attachment { font-size: 8.5pt; color: #6b7280; margin-top: 4px; font-style: italic; }
      .todo-row { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid #f3f4f6; }
      .todo-status { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #9ca3af; margin-top: 2px; flex-shrink: 0; }
      .todo-done-circle { background: #10b981; border-color: #10b981; }
      .todo-text { flex: 1; font-size: 10pt; }
      .todo-meta { font-size: 8pt; color: #6b7280; margin-top: 2px; }
      .footer { margin-top: 30px; font-size: 8pt; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    </style>`;
}

/** Projekt + Kundenname aus DB laden */
async function loadProjectInfo(projectId: number): Promise<{ projectTitle: string; customerName: string }> {
  const db = await getDb();
  if (!db) return { projectTitle: `Projekt ${projectId}`, customerName: "Unbekannter Kunde" };
  const rows = await db
    .select({
      title: projects.title,
      customerName: customers.name,
      customerCompany: customers.company,
    })
    .from(projects)
    .leftJoin(customers, eq(projects.customerId, customers.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  const row = rows[0];
  const projectTitle = row?.title ?? `Projekt ${projectId}`;
  const customerName = row?.customerCompany || row?.customerName || "Unbekannter Kunde";
  return { projectTitle, customerName };
}

/** Portal-Passwort prüfen */
async function checkPortalPassword(projectId: number, password: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const cfgRows = await db
    .select()
    .from(projectPortalConfig)
    .where(eq(projectPortalConfig.projectId, projectId))
    .limit(1);
  return !!(cfgRows[0] && cfgRows[0].password === password);
}

// ─── Input-Schemas ────────────────────────────────────────────────────────────
const projectIdInput = z.object({ projectId: z.number().int().positive() });
const portalInput = z.object({
  projectId: z.number().int().positive(),
  password: z.string().min(1),
});

// ─── Router ───────────────────────────────────────────────────────────────────
export const chatExportRouter = router({

  // ── 1. Chatverlauf als PDF (ERP) ───────────────────────────────────────────
  chatPdf: protectedProcedure
    .input(projectIdInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectId } = input;
      const { projectTitle, customerName } = await loadProjectInfo(projectId);

      const messages = await db
        .select()
        .from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, projectId))
        .orderBy(asc(projectChatMessages.createdAt));

      const msgHtml = messages.map(m => {
        const cls = m.senderType === "erp" ? "msg msg-erp" : "msg msg-customer";
        const attachHtml = m.attachmentName
          ? `<div class="msg-attachment">Anhang: ${escHtml(m.attachmentName)}</div>`
          : "";
        return `<div class="${cls}">
          <div class="msg-meta"><span class="msg-sender">${escHtml(m.senderName)}</span> &nbsp;·&nbsp; ${fmtDateTime(m.createdAt)}</div>
          <div class="msg-text">${escHtml(m.content)}</div>${attachHtml}</div>`;
      }).join("");

      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">${buildPdfStyles()}</head><body>
        ${buildPdfHeader(projectTitle, customerName, `Chatverlauf · Exportiert am ${fmtDate(Date.now())}`)}
        <div class="section-title">Nachrichten (${messages.length})</div>
        ${msgHtml || '<p style="color:#9ca3af">Keine Nachrichten vorhanden.</p>'}
        <div class="footer">Fabrica GmbH · Hüttenstraße 205, 50170 Kerpen-Sindorf · kontakt@fabrica3d.eu</div>
      </body></html>`;

      const buffer = await htmlToPdf(html);
      return { base64: buffer.toString("base64"), filename: `Chatverlauf_${slugify(projectTitle)}_${todaySlug()}.pdf`, mimeType: "application/pdf" };
    }),

  // ── 1b. Chatverlauf als PDF (Portal) ──────────────────────────────────────
  chatPdfPortal: publicProcedure
    .input(portalInput)
    .mutation(async ({ input }) => {
      if (!(await checkPortalPassword(input.projectId, input.password))) throw new Error("UNAUTHORIZED");
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle, customerName } = await loadProjectInfo(input.projectId);

      const messages = await db
        .select().from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));

      const msgHtml = messages.map(m => {
        const cls = m.senderType === "erp" ? "msg msg-erp" : "msg msg-customer";
        const attachHtml = m.attachmentName ? `<div class="msg-attachment">Anhang: ${escHtml(m.attachmentName)}</div>` : "";
        return `<div class="${cls}"><div class="msg-meta"><span class="msg-sender">${escHtml(m.senderName)}</span> &nbsp;·&nbsp; ${fmtDateTime(m.createdAt)}</div><div class="msg-text">${escHtml(m.content)}</div>${attachHtml}</div>`;
      }).join("");

      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">${buildPdfStyles()}</head><body>
        ${buildPdfHeader(projectTitle, customerName, `Chatverlauf · Exportiert am ${fmtDate(Date.now())}`)}
        <div class="section-title">Nachrichten (${messages.length})</div>
        ${msgHtml || '<p style="color:#9ca3af">Keine Nachrichten vorhanden.</p>'}
        <div class="footer">Fabrica GmbH · Hüttenstraße 205, 50170 Kerpen-Sindorf · kontakt@fabrica3d.eu</div>
      </body></html>`;

      const buffer = await htmlToPdf(html);
      return { base64: buffer.toString("base64"), filename: `Chatverlauf_${slugify(projectTitle)}_${todaySlug()}.pdf`, mimeType: "application/pdf" };
    }),

  // ── 2. Chatverlauf als CSV (ERP) ───────────────────────────────────────────
  chatCsv: protectedProcedure
    .input(projectIdInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle } = await loadProjectInfo(input.projectId);

      const messages = await db
        .select().from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));

      const e = (s: string | null | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;
      const csv = "\uFEFF" + "Datum;Uhrzeit;Absender;Nachrichtentext;Anhang\r\n" +
        messages.map(m => [e(fmtDate(m.createdAt)), e(fmtTime(m.createdAt)), e(m.senderName), e(m.content), e(m.attachmentName ?? "")].join(";")).join("\r\n");

      return { base64: Buffer.from(csv, "utf8").toString("base64"), filename: `Chatverlauf_${slugify(projectTitle)}_${todaySlug()}.csv`, mimeType: "text/csv;charset=utf-8" };
    }),

  // ── 2b. Chatverlauf als CSV (Portal) ──────────────────────────────────────
  chatCsvPortal: publicProcedure
    .input(portalInput)
    .mutation(async ({ input }) => {
      if (!(await checkPortalPassword(input.projectId, input.password))) throw new Error("UNAUTHORIZED");
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle } = await loadProjectInfo(input.projectId);

      const messages = await db
        .select().from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));

      const e = (s: string | null | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;
      const csv = "\uFEFF" + "Datum;Uhrzeit;Absender;Nachrichtentext;Anhang\r\n" +
        messages.map(m => [e(fmtDate(m.createdAt)), e(fmtTime(m.createdAt)), e(m.senderName), e(m.content), e(m.attachmentName ?? "")].join(";")).join("\r\n");

      return { base64: Buffer.from(csv, "utf8").toString("base64"), filename: `Chatverlauf_${slugify(projectTitle)}_${todaySlug()}.csv`, mimeType: "text/csv;charset=utf-8" };
    }),

  // ── 3. Todo-Liste als PDF (ERP) ────────────────────────────────────────────
  todosPdf: protectedProcedure
    .input(projectIdInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle, customerName } = await loadProjectInfo(input.projectId);

      const todos = await db
        .select().from(projectTodos)
        .where(eq(projectTodos.projectId, input.projectId))
        .orderBy(asc(projectTodos.createdAt));

      const open = todos.filter(t => t.status === "open");
      const done = todos.filter(t => t.status === "done");

      const renderTodo = (t: typeof todos[0]) => `
        <div class="todo-row">
          <div class="todo-status ${t.status === "done" ? "todo-done-circle" : ""}"></div>
          <div class="todo-text">
            <div>${escHtml(t.text)}</div>
            <div class="todo-meta">
              Erstellt von: <strong>${escHtml(t.createdBy)}</strong> · ${fmtDate(t.createdAt)}
              ${t.assignedTo ? ` · Zugewiesen an: <strong>${escHtml(t.assignedTo)}</strong>` : ""}
              ${t.doneAt ? ` · Erledigt am: ${fmtDate(t.doneAt)}${t.doneBy ? ` von ${escHtml(t.doneBy)}` : ""}` : ""}
              ${t.handoverComment ? `<br/>Übergabe: ${escHtml(t.handoverComment)}` : ""}
            </div>
          </div>
        </div>`;

      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">${buildPdfStyles()}</head><body>
        ${buildPdfHeader(projectTitle, customerName, `Aufgabenliste · Exportiert am ${fmtDate(Date.now())}`)}
        ${open.length > 0 ? `<div class="section-title">Offene Aufgaben (${open.length})</div>${open.map(renderTodo).join("")}` : ""}
        ${done.length > 0 ? `<div class="section-title">Erledigte Aufgaben (${done.length})</div>${done.map(renderTodo).join("")}` : ""}
        ${todos.length === 0 ? '<p style="color:#9ca3af">Keine Aufgaben vorhanden.</p>' : ""}
        <div class="footer">Fabrica GmbH · Hüttenstraße 205, 50170 Kerpen-Sindorf · kontakt@fabrica3d.eu</div>
      </body></html>`;

      const buffer = await htmlToPdf(html);
      return { base64: buffer.toString("base64"), filename: `Aufgaben_${slugify(projectTitle)}_${todaySlug()}.pdf`, mimeType: "application/pdf" };
    }),

  // ── 3b. Todo-Liste als PDF (Portal) ───────────────────────────────────────
  todosPdfPortal: publicProcedure
    .input(portalInput)
    .mutation(async ({ input }) => {
      if (!(await checkPortalPassword(input.projectId, input.password))) throw new Error("UNAUTHORIZED");
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle, customerName } = await loadProjectInfo(input.projectId);

      const todos = await db
        .select().from(projectTodos)
        .where(eq(projectTodos.projectId, input.projectId))
        .orderBy(asc(projectTodos.createdAt));

      const open = todos.filter(t => t.status === "open");
      const done = todos.filter(t => t.status === "done");

      const renderTodo = (t: typeof todos[0]) => `
        <div class="todo-row">
          <div class="todo-status ${t.status === "done" ? "todo-done-circle" : ""}"></div>
          <div class="todo-text">
            <div>${escHtml(t.text)}</div>
            <div class="todo-meta">
              Erstellt von: <strong>${escHtml(t.createdBy)}</strong> · ${fmtDate(t.createdAt)}
              ${t.assignedTo ? ` · Zugewiesen an: <strong>${escHtml(t.assignedTo)}</strong>` : ""}
              ${t.doneAt ? ` · Erledigt am: ${fmtDate(t.doneAt)}${t.doneBy ? ` von ${escHtml(t.doneBy)}` : ""}` : ""}
              ${t.handoverComment ? `<br/>Übergabe: ${escHtml(t.handoverComment)}` : ""}
            </div>
          </div>
        </div>`;

      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">${buildPdfStyles()}</head><body>
        ${buildPdfHeader(projectTitle, customerName, `Aufgabenliste · Exportiert am ${fmtDate(Date.now())}`)}
        ${open.length > 0 ? `<div class="section-title">Offene Aufgaben (${open.length})</div>${open.map(renderTodo).join("")}` : ""}
        ${done.length > 0 ? `<div class="section-title">Erledigte Aufgaben (${done.length})</div>${done.map(renderTodo).join("")}` : ""}
        ${todos.length === 0 ? '<p style="color:#9ca3af">Keine Aufgaben vorhanden.</p>' : ""}
        <div class="footer">Fabrica GmbH · Hüttenstraße 205, 50170 Kerpen-Sindorf · kontakt@fabrica3d.eu</div>
      </body></html>`;

      const buffer = await htmlToPdf(html);
      return { base64: buffer.toString("base64"), filename: `Aufgaben_${slugify(projectTitle)}_${todaySlug()}.pdf`, mimeType: "application/pdf" };
    }),

  // ── 4. Todo-Liste als CSV (ERP) ────────────────────────────────────────────
  todosCsv: protectedProcedure
    .input(projectIdInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle } = await loadProjectInfo(input.projectId);

      const todos = await db
        .select().from(projectTodos)
        .where(eq(projectTodos.projectId, input.projectId))
        .orderBy(asc(projectTodos.createdAt));

      const e = (s: string | null | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;
      const csv = "\uFEFF" + "Aufgabentext;Zugewiesen an;Erstellt von;Erstellt am;Status;Erledigt am;Übergabekommentar\r\n" +
        todos.map(t => [e(t.text), e(t.assignedTo ?? ""), e(t.createdBy), e(fmtDate(t.createdAt)),
          e(t.status === "done" ? "Erledigt" : "Offen"), e(t.doneAt ? fmtDate(t.doneAt) : ""), e(t.handoverComment ?? "")].join(";")).join("\r\n");

      return { base64: Buffer.from(csv, "utf8").toString("base64"), filename: `Aufgaben_${slugify(projectTitle)}_${todaySlug()}.csv`, mimeType: "text/csv;charset=utf-8" };
    }),

  // ── 4b. Todo-Liste als CSV (Portal) ───────────────────────────────────────
  todosCsvPortal: publicProcedure
    .input(portalInput)
    .mutation(async ({ input }) => {
      if (!(await checkPortalPassword(input.projectId, input.password))) throw new Error("UNAUTHORIZED");
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle } = await loadProjectInfo(input.projectId);

      const todos = await db
        .select().from(projectTodos)
        .where(eq(projectTodos.projectId, input.projectId))
        .orderBy(asc(projectTodos.createdAt));

      const e = (s: string | null | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;
      const csv = "\uFEFF" + "Aufgabentext;Zugewiesen an;Erstellt von;Erstellt am;Status;Erledigt am;Übergabekommentar\r\n" +
        todos.map(t => [e(t.text), e(t.assignedTo ?? ""), e(t.createdBy), e(fmtDate(t.createdAt)),
          e(t.status === "done" ? "Erledigt" : "Offen"), e(t.doneAt ? fmtDate(t.doneAt) : ""), e(t.handoverComment ?? "")].join(";")).join("\r\n");

      return { base64: Buffer.from(csv, "utf8").toString("base64"), filename: `Aufgaben_${slugify(projectTitle)}_${todaySlug()}.csv`, mimeType: "text/csv;charset=utf-8" };
    }),

  // ── 5. Alle Anhänge als ZIP (ERP) ─────────────────────────────────────────
  attachmentsZip: protectedProcedure
    .input(projectIdInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle } = await loadProjectInfo(input.projectId);

      const messages = await db
        .select().from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));

      const withAttachments = messages.filter(m => m.attachmentUrl && m.attachmentName);
      if (withAttachments.length === 0) {
        return { empty: true, filename: "", base64: "", mimeType: "" };
      }

      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = archiver("zip", { zlib: { level: 6 } });
        const chunks: Buffer[] = [];
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);

        Promise.all(withAttachments.map(async (m) => {
          try {
            const resp = await axios.get(m.attachmentUrl!, { responseType: "arraybuffer", timeout: 15000 });
            const prefix = `${fmtDate(m.createdAt).replace(/\./g, "-")}_${slugify(m.senderName)}`;
            archive.append(Buffer.from(resp.data), { name: `${prefix}_${m.attachmentName}` });
          } catch { /* überspringen */ }
        })).then(() => archive.finalize()).catch(reject);
      });

      return { empty: false, base64: zipBuffer.toString("base64"), filename: `Anhaenge_${slugify(projectTitle)}_${todaySlug()}.zip`, mimeType: "application/zip" };
    }),

  // ── 5b. Alle Anhänge als ZIP (Portal) ─────────────────────────────────────
  attachmentsZipPortal: publicProcedure
    .input(portalInput)
    .mutation(async ({ input }) => {
      if (!(await checkPortalPassword(input.projectId, input.password))) throw new Error("UNAUTHORIZED");
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { projectTitle } = await loadProjectInfo(input.projectId);

      const messages = await db
        .select().from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));

      const withAttachments = messages.filter(m => m.attachmentUrl && m.attachmentName);
      if (withAttachments.length === 0) {
        return { empty: true, filename: "", base64: "", mimeType: "" };
      }

      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = archiver("zip", { zlib: { level: 6 } });
        const chunks: Buffer[] = [];
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);

        Promise.all(withAttachments.map(async (m) => {
          try {
            const resp = await axios.get(m.attachmentUrl!, { responseType: "arraybuffer", timeout: 15000 });
            const prefix = `${fmtDate(m.createdAt).replace(/\./g, "-")}_${slugify(m.senderName)}`;
            archive.append(Buffer.from(resp.data), { name: `${prefix}_${m.attachmentName}` });
          } catch { /* überspringen */ }
        })).then(() => archive.finalize()).catch(reject);
      });

      return { empty: false, base64: zipBuffer.toString("base64"), filename: `Anhaenge_${slugify(projectTitle)}_${todaySlug()}.zip`, mimeType: "application/zip" };
    }),
});
