import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { renderInvoicePdf } from "./pdfRenderer";
import archiver from "archiver";
import {
  getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer,
  getLeadSources, createLeadSource, updateLeadSource, deleteLeadSource,
  getProjects, getProjectById, createProject, updateProject, deleteProject,
  getProjectItems, createProjectItem, updateProjectItem, deleteProjectItem,
  getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier,
  getRfqsByProject, createRfq, updateRfq, getRfqResponses, createRfqResponse, selectBestRfqResponse,
  getShipmentsByProject, createShipment, updateShipment,
  getCadFilesByProject, createCadFile, deleteCadFile,
  getConsultationEntries, createConsultationEntry, updateConsultationEntry, deleteConsultationEntry,
  getMaterials, createMaterial, updateMaterial, deleteMaterial,
  getKnowledgeEntries, createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry,
  getImageLibrary, createImageEntry, deleteImageEntry,
  getAiSessions, createAiSession, updateAiSession,
  getDashboardStats,
  getQuickNotes, createQuickNote, deleteQuickNote, updateQuickNote, getDueQuickNoteReminders, markQuickNoteReminderSent,
  getFullExport,
  getNotes, getNoteById, createNote, updateNote, deleteNote,
  getNoteAttachments, addNoteAttachment, deleteNoteAttachment,
  getNoteReminders, addNoteReminder, deleteNoteReminder,
  getPendingReminders, markReminderSent,
  getComplaintsByProject, getAllComplaints, createComplaint, updateComplaint, deleteComplaint,
  addComplaintAttachment, deleteComplaintAttachment,
  getInvoices, getInvoiceById, createInvoice, updateInvoice, changeInvoiceStatus,
  lockInvoice, cancelInvoice, deleteInvoiceDraft, getInvoiceAuditLog, getNextInvoiceNumber, assignInvoiceNumber,
  getCompanySettings, upsertCompanySettings,
  listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvent,
  getNextInquiryNumber, listInquiries, getInquiryById, getInquiryItems,
  createInquiry, updateInquiry, deleteInquiry, replaceInquiryItems,
} from "./db";

const EMAIL_SIGNATURE = `\n\nMit freundlichen Grüßen / Best Regards\n\nDaniel Rincón\n\nFabrica GmbH\nHüttenstraße 205\n50170 Kerpen-Sindorf\n\nTel.: +49(0)2273-9529429\nMobil: +49(0)170/8342238\nd.rincon@fabrica3d.eu\nwww.fabrica3d.de`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return getDashboardStats();
    }),
  }),

  // ─── Customers ──────────────────────────────────────────────────────────────
  customers: router({
    list: protectedProcedure.query(async () => getCustomers()),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getCustomerById(input.id)),

    // Kunden + Lieferanten kombiniert für Projektauswahl
    listForProjects: protectedProcedure.query(async () => {
      const db = await (await import('./db')).getDb();
      if (!db) return [];
      const { customers: customersTable, suppliers: suppliersTable } = await import('../drizzle/schema');
      const { asc } = await import('drizzle-orm');
      const customerRows = await db
        .select({ id: customersTable.id, name: customersTable.name, company: customersTable.company })
        .from(customersTable)
        .orderBy(asc(customersTable.name));
      const supplierRows = await db
        .select({ id: suppliersTable.id, name: suppliersTable.name, company: suppliersTable.company })
        .from(suppliersTable)
        .orderBy(asc(suppliersTable.name));
      const customers_ = customerRows.map(r => ({
        id: r.id,
        label: r.company ? `${r.company} (${r.name})` : r.name,
        group: 'Kunden' as const,
        sourceType: 'customer' as const,
        supplierId: null as null,
      }));
      const suppliers_ = supplierRows.map(r => ({
        id: null as null,  // Lieferanten haben keine customerId
        label: r.company ? `${r.company} (${r.name})` : r.name,
        group: 'Lieferanten' as const,
        sourceType: 'supplier' as const,
        supplierId: r.id,
      }));
      // Gemeinsame Liste mit eindeutiger Composite-ID für Frontend
      const combined = [
        ...customers_.map(c => ({ compositeId: `c:${c.id}`, label: c.label, group: c.group, customerId: c.id, supplierId: null as number | null })),
        ...suppliers_.map(s => ({ compositeId: `s:${s.supplierId}`, label: s.label, group: s.group, customerId: null as number | null, supplierId: s.supplierId })),
      ].sort((a, b) => a.label.localeCompare(b.label, 'de'));
      return combined;
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      company: z.string().optional(),
      type: z.enum(["b2b", "museum", "industry", "private", "other"]).default("b2b"),
      email: z.string().optional(),
      email2: z.string().optional(),
      email3: z.string().optional(),
      phone: z.string().optional(),
      contact2: z.string().optional(),
      contact3: z.string().optional(),
      street: z.string().optional(),
      zip: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      sevdeskId: z.string().optional(),
      website: z.string().optional(),
      flags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => { await createCustomer(input as any); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      type: z.enum(["b2b", "museum", "industry", "private", "other"]).optional(),
      email: z.string().optional(),
      email2: z.string().optional(),
      email3: z.string().optional(),
      phone: z.string().optional(),
      contact2: z.string().optional(),
      contact3: z.string().optional(),
      street: z.string().optional(),
      zip: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
      website: z.string().optional(),
      flags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateCustomer(id, data as any); return { success: true }; }),
     delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteCustomer(input.id); return { success: true }; }),

    // CSV-Import (sevDesk-kompatibel)
    importCsv: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        name: z.string(),
        company: z.string().optional(),
        type: z.enum(["b2b", "museum", "industry", "private", "other"]).optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        notes: z.string().optional(),
        sevdeskId: z.string().optional(),
      })),
      onDuplicate: z.enum(["skip", "update"]).default("skip"),
    })).mutation(async ({ input }) => {
      const db = await (await import('./db')).getDb();
      if (!db) throw new Error('DB nicht verfügbar');
      const { customers: customersTable } = await import('../drizzle/schema');
      const { eq, or } = await import('drizzle-orm');

      let created = 0, updated = 0, skipped = 0;

      for (const row of input.rows) {
        if (!row.name && !row.company) { skipped++; continue; }
        const displayName = row.name || row.company || '';

        // Duplikat-Erkennung: gleiche E-Mail ODER gleiche Firma+Name
        const existing = row.email
          ? await db.select().from(customersTable)
              .where(eq(customersTable.email, row.email))
              .limit(1)
          : await db.select().from(customersTable)
              .where(eq(customersTable.name, displayName))
              .limit(1);

        if (existing.length > 0) {
          if (input.onDuplicate === 'update') {
            await db.update(customersTable)
              .set({
                company: row.company || existing[0].company,
                phone: row.phone || existing[0].phone,
                street: row.street || existing[0].street,
                zip: row.zip || existing[0].zip,
                city: row.city || existing[0].city,
                country: row.country || existing[0].country,
                notes: row.notes || existing[0].notes,
                sevdeskId: row.sevdeskId || existing[0].sevdeskId,
              })
              .where(eq(customersTable.id, existing[0].id));
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Neu anlegen
        await db.insert(customersTable).values({
          name: displayName,
          company: row.company || null,
          type: row.type ?? 'b2b',
          email: row.email || null,
          phone: row.phone || null,
          street: row.street || null,
          zip: row.zip || null,
          city: row.city || null,
          country: row.country || 'Deutschland',
          notes: row.notes || null,
          sevdeskId: row.sevdeskId || null,
          isActive: 1,
        });
        created++;
      }

      return { created, updated, skipped, total: input.rows.length };
    }),
  }),
  // ─── Lead Sources ────────────────────────────────────────────────────────────
  leadSources: router({
    list: protectedProcedure.query(async () => getLeadSources()),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      type: z.enum(["website", "google_ads", "referral", "direct", "other"]).default("other"),
      monthlyCost: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { await createLeadSource(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      type: z.enum(["website", "google_ads", "referral", "direct", "other"]).optional(),
      monthlyCost: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateLeadSource(id, data as any); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteLeadSource(input.id); return { success: true }; }),
  }),

  // ─── Projects ────────────────────────────────────────────────────────────────
  projects: router({
    list: protectedProcedure.input(z.object({
      status: z.string().optional(),
      type: z.string().optional(),
    }).optional()).query(async ({ input }) => getProjects(input)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getProjectById(input.id)),
    create: protectedProcedure.input(z.object({
      title: z.string().min(1),
      projectNumber: z.string().optional(),
      type: z.enum(["serial_part", "spare_part", "museum", "consulting", "cad_work", "other"]).default("other"),
      status: z.enum(["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"]).default("inquiry"),
      customerId: z.number().optional(),
      supplierId: z.number().optional(),
      leadSourceId: z.number().optional(),
      driveFolderUrl: z.string().optional(),
      notes: z.string().optional(),
      internalNotes: z.string().optional(),
      deadline: z.date().optional(),
    })).mutation(async ({ input }) => { await createProject(input as any); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      projectNumber: z.string().optional(),
      type: z.enum(["serial_part", "spare_part", "museum", "consulting", "cad_work", "other"]).optional(),
      status: z.enum(["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"]).optional(),
      customerId: z.number().nullable().optional(),
      supplierId: z.number().nullable().optional(),
      leadSourceId: z.number().nullable().optional(),
      driveFolderUrl: z.string().optional(),
      notes: z.string().nullable().optional(),
      internalNotes: z.string().optional(),
      deadline: z.date().nullable().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;

      // Vor dem Update: alten Projektnamen und Kundennamen laden (für Drive-Umbenennung)
      const oldProject = await getProjectById(id);

      // Projekt in DB aktualisieren
      await updateProject(id, data as any);

      // Drive-Ordner umbenennen wenn Titel oder Projektnummer geändert wurde
      if (oldProject && (input.title !== undefined || input.projectNumber !== undefined)) {
        try {
          const { getCustomerById, getSupplierById } = await import('./db');
          const { renameDriveProjectFolder } = await import('./googleDrive');

          // Entitätsname ermitteln (Kunde oder Lieferant)
          let entityName: string | null = null;
          const effectiveCustomerId = input.customerId !== undefined ? input.customerId : oldProject.customerId;
          const effectiveSupplierId = (input.supplierId !== undefined ? input.supplierId : (oldProject as any).supplierId);
          if (effectiveCustomerId) {
            const customer = await getCustomerById(effectiveCustomerId);
            entityName = customer ? (customer.company || customer.name) : null;
          } else if (effectiveSupplierId) {
            const supplier = await getSupplierById(effectiveSupplierId);
            entityName = supplier ? (supplier.company || supplier.name) : null;
          }

          console.log('[Drive] Projekt-Update: entityName=', entityName, 'customerId=', effectiveCustomerId, 'supplierId=', effectiveSupplierId);

          if (entityName) {
            // Alten und neuen Projektnamen berechnen
            const buildName = (num: string | null | undefined, title: string) =>
              num ? `${num} ${title}`.substring(0, 100) : title.substring(0, 100);

            const oldProjectName = buildName(oldProject.projectNumber, oldProject.title);
            const newTitle = input.title !== undefined ? input.title : oldProject.title;
            const newNumber = input.projectNumber !== undefined ? input.projectNumber : oldProject.projectNumber;
            const newProjectName = buildName(newNumber, newTitle);

            console.log('[Drive] Umbenennung:', oldProjectName, '->', newProjectName);

            if (oldProjectName !== newProjectName) {
              const renamed = await renameDriveProjectFolder(entityName, oldProjectName, newProjectName);
              console.log('[Drive] Umbenennung Ergebnis:', renamed);
            } else {
              console.log('[Drive] Kein Unterschied im Namen, keine Umbenennung nötig');
            }
          } else {
            console.log('[Drive] Kein Kunde/Lieferant zugewiesen – keine Ordner-Umbenennung');
          }
        } catch (e) {
          // Drive-Umbenennung ist nicht-kritisch – Fehler still loggen
          console.error('[Drive] Ordner-Umbenennung fehlgeschlagen:', e);
        }
      }

      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteProject(input.id); return { success: true }; }),
    changeStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled", "rejected"]),
    })).mutation(async ({ input }) => { await updateProject(input.id, { status: input.status }); return { success: true }; }),
    archive: protectedProcedure.input(z.object({
      id: z.number(),
      rejectionReason: z.enum(['preis','timing','wettbewerber','kein_feedback','sonstiges']),
      rejectionNote: z.string().optional(),
    })).mutation(async ({ input }) => {
      const db = await (await import('./db')).getDb();
      if (!db) throw new Error('DB nicht verfügbar');
      const { projects: projectsTable } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db.update(projectsTable).set({
        status: 'rejected',
        archivedAt: now,
        rejectionReason: input.rejectionReason,
        rejectionNote: input.rejectionNote ?? null,
        reactivatedAt: null,
      }).where(eq(projectsTable.id, input.id));
      return { success: true };
    }),
    reactivate: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await (await import('./db')).getDb();
      if (!db) throw new Error('DB nicht verfügbar');
      const { projects: projectsTable } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db.update(projectsTable).set({
        status: 'inquiry',
        archivedAt: null,
        rejectionReason: null,
        rejectionNote: null,
        reactivatedAt: now,
      }).where(eq(projectsTable.id, input.id));
      return { success: true };
    }),
    listArchived: protectedProcedure.input(z.object({
      year: z.number().optional(),
      rejectionReason: z.string().optional(),
      customerId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const db = await (await import('./db')).getDb();
      if (!db) return [];
      const { projects: projectsTable, customers: customersTable } = await import('../drizzle/schema');
      const { eq, desc } = await import('drizzle-orm');
      const rows = await db.select({
        id: projectsTable.id,
        projectNumber: projectsTable.projectNumber,
        title: projectsTable.title,
        type: projectsTable.type,
        status: projectsTable.status,
        customerId: projectsTable.customerId,
        archivedAt: projectsTable.archivedAt,
        rejectionReason: projectsTable.rejectionReason,
        rejectionNote: projectsTable.rejectionNote,
        reactivatedAt: projectsTable.reactivatedAt,
        totalVk: projectsTable.totalVk,
        createdAt: projectsTable.createdAt,
        customerName: customersTable.name,
        customerCompany: customersTable.company,
      }).from(projectsTable)
        .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
        .where(eq(projectsTable.status, 'rejected'))
        .orderBy(desc(projectsTable.archivedAt));
      let filtered = rows as any[];
      if (input?.year) filtered = filtered.filter((r: any) => r.archivedAt && new Date(r.archivedAt).getFullYear() === input.year);
      if (input?.rejectionReason) filtered = filtered.filter((r: any) => r.rejectionReason === input.rejectionReason);
      if (input?.customerId) filtered = filtered.filter((r: any) => r.customerId === input.customerId);
      return filtered;
    }),
    getDriveFolderUrl: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getProjectById, getCustomerById, getSupplierById } = await import('./db');
      const { getProjectDriveFolderUrl } = await import('./googleDrive');
      const project = await getProjectById(input.id);
      if (!project) throw new Error('Projekt nicht gefunden');
      let entityName: string | null = null;
      if (project.customerId) {
        const customer = await getCustomerById(project.customerId);
        entityName = customer ? (customer.company || customer.name) : null;
      } else if ((project as any).supplierId) {
        const supplier = await getSupplierById((project as any).supplierId);
        entityName = supplier ? (supplier.company || supplier.name) : null;
      }
      if (!entityName) return { url: null };
      const projectName = project.projectNumber
        ? `${project.projectNumber} ${project.title}`.substring(0, 100)
        : project.title.substring(0, 100);
      const url = await getProjectDriveFolderUrl(entityName, projectName);
      return { url };
    }),
    // Auftragsbestätigung per E-Mail senden
    sendOrderConfirmation: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        to: z.string().email(),
        cc: z.string().optional(),
        subject: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { getCompanySettings, getProjectById, getProjectItems, getCustomerById } = await import('./db');
        const { sendEmail } = await import('./email');
        const { generateOrderConfirmationPdf } = await import('./pdfGenerator');
        const cs = await getCompanySettings();
        if (!cs?.smtpHost || !cs?.smtpUser || !cs?.smtpPass) {
          throw new Error('SMTP nicht konfiguriert. Bitte SMTP-Einstellungen in den Firmen-Einstellungen hinterlegen.');
        }
        const project = await getProjectById(input.projectId);
        if (!project) throw new Error('Projekt nicht gefunden');
        const items = await getProjectItems(input.projectId);
        const customer = project.customerId ? await getCustomerById(project.customerId) : null;
        // Positionen-Tabelle HTML
        const itemRows = items.map((it: any, i: number) => {
          const qty = parseFloat(it.quantity ?? 1);
          const unitVk = parseFloat(it.unitVk ?? 0);
          const totalVk = parseFloat(it.totalVk ?? (qty * unitVk));
          return `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.name ?? it.description ?? ''}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${qty.toLocaleString('de-DE')}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">Stk.</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${unitVk.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${totalVk.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
          </tr>`;
        }).join('');
        const totalVkSum = items.reduce((s: number, it: any) => s + parseFloat(it.totalVk ?? 0), 0);
        const taxRate = 0.19;
        const net = totalVkSum / (1 + taxRate);
        const tax = totalVkSum - net;
        const logoUrl = cs.logoUrl ?? '';
        const issueDate = new Date().toLocaleDateString('de-DE');
        const customerAddr = customer ? [
          customer.company || customer.name,
          customer.street,
          `${customer.zip ?? ''} ${customer.city ?? ''}`.trim(),
          customer.country !== 'Deutschland' ? customer.country : '',
        ].filter(Boolean).join('<br>') : '';
        const signatureHtml = cs.emailSignature
          ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;white-space:pre-wrap;">${cs.emailSignature}</div>`
          : '';
        const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:700px;margin:0 auto;padding:24px;">
  <table style="width:100%;margin-bottom:24px;"><tr>
    <td style="vertical-align:top;width:50%;">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:70px;max-width:200px;object-fit:contain;margin-bottom:8px;display:block;">` : ''}
      <strong>${cs.name ?? 'Fabrica GmbH'}</strong><br>
      ${cs.street ?? ''}<br>${cs.zip ?? ''} ${cs.city ?? ''}<br>
      ${cs.phone ?? ''}<br>${cs.email ?? ''}
    </td>
    <td style="vertical-align:top;text-align:right;">
      <p style="margin:0;font-size:11px;color:#6b7280;">Datum: ${issueDate}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Projekt-Nr.: ${project.projectNumber ?? project.id}</p>
    </td>
  </tr></table>
  ${customerAddr ? `<div style="margin-bottom:24px;">${customerAddr}</div>` : ''}
  <h2 style="font-size:18px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:16px;">Auftragsbestätigung</h2>
  <p style="margin-bottom:8px;"><strong>Projekt:</strong> ${project.title}</p>
  <div style="white-space:pre-wrap;margin-bottom:20px;line-height:1.6;">${input.body}</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead><tr style="background:#f5f5f5;">
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:left;">#</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:left;">Bezeichnung</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:right;">Menge</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;">Einheit</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:right;">Einzelpreis</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:right;">Gesamt</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr><td colspan="5" style="padding:4px 8px;text-align:right;">Nettobetrag:</td><td style="padding:4px 8px;text-align:right;">${net.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>
      <tr><td colspan="5" style="padding:4px 8px;text-align:right;">MwSt. 19%:</td><td style="padding:4px 8px;text-align:right;">${tax.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>
      <tr style="font-weight:700;font-size:15px;border-top:2px solid #111;"><td colspan="5" style="padding:6px 8px;text-align:right;">Gesamtbetrag:</td><td style="padding:6px 8px;text-align:right;">${totalVkSum.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>
    </tfoot>
  </table>
  <p style="font-size:11px;color:#6b7280;margin-top:8px;">USt.-ID: ${cs.vatId ?? ''} | Steuer-Nr.: ${cs.taxNumber ?? ''}</p>
  <p style="font-size:11px;color:#6b7280;">IBAN: ${cs.iban ?? ''} | BIC: ${cs.bic ?? ''} | ${cs.bankName ?? ''}</p>
  ${signatureHtml}
</body></html>`;
        // PDF generieren
        let pdfBuffer: Buffer | undefined;
        try {
          const pdfData = {
            companyName: cs.name ?? 'Fabrica GmbH',
            companyStreet: cs.street ?? '',
            companyZip: cs.zip ?? '',
            companyCity: cs.city ?? '',
            companyPhone: cs.phone ?? '',
            companyEmail: cs.email ?? '',
            companyWebsite: cs.website ?? '',
            companyLogoUrl: cs.logoUrl ?? '',
            vatId: cs.vatId ?? '',
            taxNumber: cs.taxNumber ?? '',
            iban: cs.iban ?? '',
            bic: cs.bic ?? '',
            bankName: cs.bankName ?? '',
            footerCol1: cs.footerCol1 ?? '',
            footerCol2: cs.footerCol2 ?? '',
            footerCol3: cs.footerCol3 ?? '',
            footerCol4: cs.footerCol4 ?? '',
            customerName: customer ? (customer.company || customer.name) : '',
            customerStreet: customer?.street ?? undefined,
            customerZip: customer?.zip ?? undefined,
            customerCity: customer?.city ?? undefined,
            customerCountry: customer?.country ?? undefined,
            projectTitle: project.title,
            projectNumber: String(project.projectNumber ?? project.id),
            issueDate: new Date().toLocaleDateString('de-DE'),
            bodyText: input.body,
            items: items.map((it: any) => ({
              name: it.name ?? it.description ?? '',
              quantity: parseFloat(it.quantity ?? 1),
              unitVk: parseFloat(it.unitVk ?? 0),
              totalVk: parseFloat(it.totalVk ?? 0),
            })),
            netAmount: net,
            taxAmount: tax,
            grossAmount: totalVkSum,
            taxRate: 19,
            kleinunternehmer: Boolean(cs.kleinunternehmer),
          };
          pdfBuffer = await generateOrderConfirmationPdf(pdfData);
        } catch (pdfErr: any) {
          console.error('[PDF] Fehler bei PDF-Generierung:', pdfErr.message);
          // PDF-Fehler ist nicht kritisch – E-Mail wird trotzdem ohne Anhang gesendet
        }
        const result = await sendEmail({
          smtpHost: cs.smtpHost,
          smtpPort: cs.smtpPort ?? 587,
          smtpUser: cs.smtpUser,
          smtpPass: cs.smtpPass,
          smtpFrom: cs.smtpFrom ?? cs.smtpUser,
          smtpSecure: Boolean(cs.smtpSecure),
          to: input.to,
          cc: input.cc,
          subject: input.subject,
          html,
          attachments: pdfBuffer ? [{
            filename: `Auftragsbestaetigung_${String(project.projectNumber ?? project.id).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }] : undefined,
        });
        if (!result.success) throw new Error(result.error ?? 'E-Mail-Versand fehlgeschlagen');
        return { success: true, messageId: result.messageId, hasPdf: !!pdfBuffer };
      }),
  }),
  // ─── Project Items ────────────────────────────────────────────────────────────
  projectItems: router({
    list: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => getProjectItems(input.projectId)),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      quantity: z.number().default(1),
      material: z.string().optional(),
      technique: z.enum(["3d_print", "cnc", "painting", "cad_work", "model_making", "assembly", "other"]).optional(),
      productionType: z.enum(["in_house", "external"]).default("external"),
      unitEk: z.string().default("0.00"),
      unitVk: z.string().default("0.00"),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { await createProjectItem(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      quantity: z.number().optional(),
      material: z.string().optional(),
      technique: z.enum(["3d_print", "cnc", "painting", "cad_work", "model_making", "assembly", "other"]).optional(),
      productionType: z.enum(["in_house", "external"]).optional(),
      unitEk: z.string().optional(),
      unitVk: z.string().optional(),
      notes: z.string().optional(),
      supplierOfferUrl: z.string().nullable().optional(),
      supplierOfferKey: z.string().nullable().optional(),
      supplierOfferName: z.string().nullable().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateProjectItem(id, data as any); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteProjectItem(input.id); return { success: true }; }),
  }),

  // ─── Suppliers ───────────────────────────────────────────────────────────────
  suppliers: router({
    list: protectedProcedure.query(async () => getSuppliers()),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getSupplierById(input.id)),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      company: z.string().optional(),
      email: z.string().optional(),
      email2: z.string().optional(),
      email3: z.string().optional(),
      phone: z.string().optional(),
      contact2: z.string().optional(),
      contact3: z.string().optional(),
      street: z.string().optional(),
      zip: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      rating: z.number().min(1).max(5).default(3),
      website: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { await createSupplier(input as any); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      email2: z.string().optional(),
      email3: z.string().optional(),
      phone: z.string().optional(),
      contact2: z.string().optional(),
      contact3: z.string().optional(),
      street: z.string().optional(),
      zip: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      rating: z.number().min(1).max(5).optional(),
      isActive: z.boolean().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateSupplier(id, data as any); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteSupplier(input.id); return { success: true }; }),
  }),

  // ─── RFQ ─────────────────────────────────────────────────────────────────────
  rfq: router({
    byProject: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => getRfqsByProject(input.projectId)),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      projectItemId: z.number().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      deadline: z.date().optional(),
      supplierIds: z.array(z.number()).default([]),
    })).mutation(async ({ input }) => { await createRfq(input as any); return { success: true }; }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["draft", "sent", "responses_received", "completed"]),
    })).mutation(async ({ input }) => { await updateRfq(input.id, { status: input.status as any }); return { success: true }; }),
    responses: protectedProcedure.input(z.object({ rfqId: z.number() })).query(async ({ input }) => getRfqResponses(input.rfqId)),
    addResponse: protectedProcedure.input(z.object({
      rfqId: z.number(),
      supplierId: z.number(),
      price: z.string().optional(),
      deliveryDays: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { await createRfqResponse(input); return { success: true }; }),
    selectBest: protectedProcedure.input(z.object({
      rfqId: z.number(),
      responseId: z.number(),
    })).mutation(async ({ input }) => { await selectBestRfqResponse(input.rfqId, input.responseId); return { success: true }; }),
  }),

  // ─── Shipments ───────────────────────────────────────────────────────────────
  shipments: router({
    byProject: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => getShipmentsByProject(input.projectId)),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      carrier: z.string().optional(),
      trackingNumber: z.string().optional(),
      shippedAt: z.date().optional(),
      estimatedDelivery: z.date().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { await createShipment(input as any); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      carrier: z.string().optional(),
      trackingNumber: z.string().optional(),
      shippedAt: z.date().optional(),
      estimatedDelivery: z.date().optional(),
      deliveredAt: z.date().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateShipment(id, data as any); return { success: true }; }),
  }),

  // ─── CAD Files ───────────────────────────────────────────────────────────────
  cadFiles: router({
    byProject: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => getCadFilesByProject(input.projectId)),
    upload: protectedProcedure.input(z.object({
      projectId: z.number(),
      projectItemId: z.number().optional(),
      filename: z.string(),
      fileData: z.string(), // base64
      mimeType: z.string().default("application/octet-stream"),
      version: z.number().default(1),
      versionNote: z.string().optional(),
      parentFileId: z.number().optional(),
      uploadedBy: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const fileKey = `cad-files/${input.projectId}/${Date.now()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await createCadFile({
        projectId: input.projectId,
        projectItemId: input.projectItemId,
        filename: input.filename,
        fileKey,
        fileUrl: url,
        fileSize: buffer.length,
        mimeType: input.mimeType,
        version: input.version,
        versionNote: input.versionNote,
        parentFileId: input.parentFileId,
        uploadedBy: input.uploadedBy ?? ctx.user.name ?? "Unknown",
      });
      // Auto-Sync nach Google Drive (im Hintergrund, kein Fehler wenn Drive nicht verfügbar)
      try {
        const project = await getProjectById(input.projectId);
        const { getSupplierById } = await import('./db');
        const customer = project?.customerId ? await getCustomerById(project.customerId) : null;
        const supplier = !customer && (project as any)?.supplierId ? await getSupplierById((project as any).supplierId) : null;
        const entityName = customer ? (customer.company || customer.name) : (supplier ? (supplier.company || supplier.name) : null);
        if (entityName && project) {
          const { uploadFileToDrive } = await import('./googleDrive');
          const projectName = project.projectNumber
            ? `${project.projectNumber} ${project.title}`.substring(0, 100)
            : project.title.substring(0, 100);
          const driveResult = await uploadFileToDrive({
            filename: input.filename,
            mimeType: input.mimeType,
            buffer,
            customerName: entityName,
            projectName,
          });
          // Drive-Status in DB speichern
          const db2 = await (await import('./db')).getDb();
          if (db2) {
            const { cadFiles: cadFilesTable } = await import('../drizzle/schema');
            const { eq: eq2, desc: desc2 } = await import('drizzle-orm');
            const [lastFile] = await db2.select({ id: cadFilesTable.id })
              .from(cadFilesTable)
              .where(eq2(cadFilesTable.projectId, input.projectId))
              .orderBy(desc2(cadFilesTable.id))
              .limit(1);
            if (lastFile) {
              await db2.update(cadFilesTable)
                .set({ driveFileId: driveResult.fileId, driveSynced: 1 })
                .where(eq2(cadFilesTable.id, lastFile.id));
            }
          }
        } // end if entityName
      } catch (e) {
        console.warn('[Drive Sync] CAD-Upload Sync fehlgeschlagen:', e);
      }
      return { success: true, url };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteCadFile(input.id); return { success: true }; }),

    // Manueller Re-Sync einer einzelnen CAD-Datei zu Google Drive
    syncToDrive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { cadFiles: cadFilesTable } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const { getProjectById, getCustomerById } = await import('./db');

        // Datei aus DB laden
        const [file] = await db.select().from(cadFilesTable).where(eq(cadFilesTable.id, input.id)).limit(1);
        if (!file) throw new Error('Datei nicht gefunden');

        // Datei von S3 herunterladen
        const fetchRes = await fetch(file.fileUrl);
        if (!fetchRes.ok) throw new Error('Datei konnte nicht von S3 geladen werden');
        const buffer = Buffer.from(await fetchRes.arrayBuffer());

        // Projekt und Kunde laden
        const project = await getProjectById(file.projectId);
        if (!project?.customerId) throw new Error('Projekt oder Kunde nicht gefunden');
        const customer = await getCustomerById(project.customerId);
        if (!customer) throw new Error('Kunde nicht gefunden');

        const { uploadFileToDrive } = await import('./googleDrive');
        const projectName = project.projectNumber
          ? `${project.projectNumber} ${project.title}`.substring(0, 100)
          : project.title.substring(0, 100);

        const driveResult = await uploadFileToDrive({
          filename: file.filename,
          mimeType: file.mimeType || 'application/octet-stream',
          buffer,
          customerName: customer.company || customer.name,
          projectName,
        });

        // Drive-Status in DB speichern
        await db.update(cadFilesTable)
          .set({ driveFileId: driveResult.fileId, driveSynced: 1 })
          .where(eq(cadFilesTable.id, input.id));

        return { success: true, driveFileId: driveResult.fileId };
      }),
  }),

  // ─── Consultation ────────────────────────────────────────────────────────────
  consultation: router({
    list: protectedProcedure.input(z.object({
      projectId: z.number().optional(),
      customerId: z.number().optional(),
    }).optional()).query(async ({ input }) => getConsultationEntries(input)),
    create: protectedProcedure.input(z.object({
      projectId: z.number().optional(),
      customerId: z.number().optional(),
      type: z.enum(["material_advice", "process_advice", "technical_analysis", "offer_discussion", "general", "other"]).default("general"),
      title: z.string().min(1),
      content: z.string().min(1),
      tags: z.array(z.string()).optional(),
      outcome: z.string().optional(),
    })).mutation(async ({ input }) => { await createConsultationEntry(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      type: z.enum(["material_advice", "process_advice", "technical_analysis", "offer_discussion", "general", "other"]).optional(),
      tags: z.array(z.string()).optional(),
      outcome: z.string().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateConsultationEntry(id, data); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteConsultationEntry(input.id); return { success: true }; }),
  }),

  // ─── Materials ───────────────────────────────────────────────────────────────
  materials: router({
    list: protectedProcedure.query(async () => getMaterials()),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      category: z.enum(["metal", "plastic", "composite", "surface_treatment", "process", "other"]).default("other"),
      properties: z.string().optional(),
      applications: z.string().optional(),
      advantages: z.string().optional(),
      disadvantages: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => { await createMaterial(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      category: z.enum(["metal", "plastic", "composite", "surface_treatment", "process", "other"]).optional(),
      properties: z.string().optional(),
      applications: z.string().optional(),
      advantages: z.string().optional(),
      disadvantages: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateMaterial(id, data); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteMaterial(input.id); return { success: true }; }),
  }),

  // ─── Knowledge Base ──────────────────────────────────────────────────────────
  knowledge: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional() }).optional()).query(async ({ input }) => getKnowledgeEntries(input?.search)),
    create: protectedProcedure.input(z.object({
      title: z.string().min(1),
      category: z.enum(["material", "surface_treatment", "process", "supplier_info", "project_type", "pricing", "general"]).default("general"),
      content: z.string().min(1),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
    })).mutation(async ({ input }) => { await createKnowledgeEntry(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      category: z.enum(["material", "surface_treatment", "process", "supplier_info", "project_type", "pricing", "general"]).optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateKnowledgeEntry(id, data as any); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteKnowledgeEntry(input.id); return { success: true }; }),
    generateDatasheet: protectedProcedure
      .input(z.object({
        topic: z.string().min(1),
        audience: z.enum(["customer", "internal", "supplier"]).default("customer"),
        language: z.enum(["de", "en"]).default("de"),
        detail: z.enum(["brief", "standard", "detailed"]).default("standard"),
        customerName: z.string().optional(),
        projectName: z.string().optional(),
        selectedEntryIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input }) => {
        // Fetch relevant knowledge entries
        const allEntries = await getKnowledgeEntries(input.topic);
        let entries = allEntries;
        if (input.selectedEntryIds && input.selectedEntryIds.length > 0) {
          const selected = await Promise.all(
            input.selectedEntryIds.map(id => getKnowledgeEntries().then(all => all.find(e => e.id === id)))
          );
          entries = selected.filter(Boolean) as typeof allEntries;
        }
        const context = entries.slice(0, 10).map(e =>
          `### ${e.title} (${e.category})\n${e.content}`
        ).join("\n\n");

        const audienceMap: Record<string, string> = {
          customer: "einem Kunden (B2B, technisch versiert)",
          internal: "internen Mitarbeitern",
          supplier: "einem Lieferanten",
        };
        const detailMap: Record<string, string> = {
          brief: "kurz und prägnant (max. 300 Wörter)",
          standard: "ausführlich mit allen wichtigen Details (400–700 Wörter)",
          detailed: "sehr detailliert mit technischen Spezifikationen (700–1200 Wörter)",
        };
        const langInstruction = input.language === "en"
          ? "Write the datasheet entirely in English."
          : "Schreibe das Datenblatt vollständig auf Deutsch.";

        const systemPrompt = `Du bist ein technischer Redakteur für eine 3D-Druck-Firma (FDM, SLA, CNC-Fräsen). ${langInstruction} Erstelle professionelle, präzise technische Datenblätter.`;

        const userPrompt = `Erstelle ein technisches Datenblatt zum Thema "${input.topic}" für ${audienceMap[input.audience]}. Detailgrad: ${detailMap[input.detail]}.
${input.customerName ? `Kundenname: ${input.customerName}` : ""}
${input.projectName ? `Projektname: ${input.projectName}` : ""}

Nutze folgende Wissensdatenbank-Einträge als Grundlage:

${context || "Kein spezifischer Kontext verfügbar — nutze allgemeines 3D-Druck-Fachwissen."}

Strukturiere das Datenblatt mit: Überschrift, kurze Einleitung, technische Spezifikationen (Tabelle wenn sinnvoll), Anwendungsgebiete, Hinweise/Einschränkungen, Kontaktinformationen-Platzhalter. Verwende Markdown-Formatierung.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        const text = typeof rawContent === "string" ? rawContent : "";
        return { text, usedEntries: entries.slice(0, 10).map(e => ({ id: e.id, title: e.title, category: e.category })) };
      }),
  }),

  // ─── Image Library ───────────────────────────────────────────────────────────
  imageLibrary: router({
    list: protectedProcedure.input(z.object({ category: z.string().optional() }).optional()).query(async ({ input }) => getImageLibrary(input?.category)),
    upload: protectedProcedure.input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["material", "surface_treatment", "process", "reference", "product", "other"]).default("other"),
      filename: z.string(),
      fileData: z.string(), // base64
      mimeType: z.string().default("image/jpeg"),
      tags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const fileKey = `image-library/${Date.now()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await createImageEntry({
        title: input.title,
        description: input.description,
        category: input.category,
        fileKey,
        fileUrl: url,
        tags: input.tags,
      });
      return { success: true, url };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteImageEntry(input.id); return { success: true }; }),
  }),

  // ─── AI Assistant ────────────────────────────────────────────────────────────
  ai: router({
    sessions: protectedProcedure.input(z.object({ projectId: z.number().optional() }).optional()).query(async ({ input }) => getAiSessions(input?.projectId)),
    generate: protectedProcedure.input(z.object({
      prompt: z.string().min(1),
      projectId: z.number().optional(),
      customerId: z.number().optional(),
      includeSignature: z.boolean().default(true),
      includeErpContext: z.boolean().default(false),
    })).mutation(async ({ input }) => {
      // Fetch relevant knowledge entries
      const knowledge = await getKnowledgeEntries(input.prompt.split(" ").slice(0, 3).join(" "));
      const knowledgeContext = knowledge.slice(0, 5).map(k => `[${k.title}]: ${k.content}`).join("\n\n");

      // ERP-Kontext aufbauen wenn gewünscht
      let erpContext = "";
      if (input.includeErpContext) {
        const [customers, projects, invoices, calEvents, stats] = await Promise.all([
          getCustomers(),
          getProjects(),
          getInvoices(),
          listCalendarEvents(Date.now() - 7 * 24 * 3600000, Date.now() + 30 * 24 * 3600000),
          getDashboardStats(),
        ]);
        const today = new Date().toLocaleDateString('de-DE');
        erpContext = `
## ERP-Kontext (Stand: ${today})

### Kunden (${customers.length})
${customers.slice(0, 10).map((c: any) => `- ${c.company || c.name} (${c.email || 'keine E-Mail'})`).join('\n')}

### Aktive Projekte (${projects.filter((p: any) => p.status === 'active').length})
${projects.filter((p: any) => p.status === 'active').slice(0, 10).map((p: any) => `- ${p.title} | Status: ${p.status} | Budget: ${p.budget ? p.budget + ' €' : 'n/a'}`).join('\n')}

### Offene Rechnungen/Angebote
${(invoices as any[]).filter((i: any) => ['draft','sent','overdue'].includes(i.status)).slice(0, 8).map((i: any) => `- ${i.invoiceNumber} | ${i.recipientName || i.recipientCompany} | ${i.totalGross} € | Status: ${i.status}`).join('\n')}

### Kommende Termine (nächste 30 Tage)
${(calEvents as any[]).slice(0, 8).map((e: any) => `- ${new Date(e.startAt).toLocaleDateString('de-DE')}: ${e.title}${e.location ? ' @ ' + e.location : ''}`).join('\n')}

### Dashboard-Kennzahlen
- Kunden gesamt: ${(stats as any).totalCustomers ?? 0}
- Projekte aktiv: ${(stats as any).activeProjects ?? 0}
- Umsatz (brutto): ${(stats as any).totalRevenue ?? 0} €
- Überfällige Rechnungen: ${(stats as any).overdueInvoices ?? 0}
`;
      }

      const systemPrompt = `Du bist ein intelligenter ERP-Assistent für Daniel Rincón, Geschäftsführer der Fabrica GmbH (3D-Druck, CNC, Oberflächenbehandlung, Modellbau, CAD). 
Du antwortest professionell auf Deutsch.

${erpContext ? erpContext + '\n' : ''}${knowledgeContext ? '## Fachwissen\n' + knowledgeContext + '\n' : 'Nutze allgemeines Fachwissen.'}

Beantworte Fragen zu Kunden, Projekten, Rechnungen, Terminen und Geschäftsdaten direkt und präzise. Für Beratungstexte und E-Mails erstelle direkt verwendbare Texte.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.prompt },
        ],
      });

      const rawContent = response.choices[0]?.message?.content;
      const generatedText = typeof rawContent === "string" ? rawContent : "";
      const finalText = input.includeSignature ? generatedText + EMAIL_SIGNATURE : generatedText;

      // Save session
      await createAiSession({
        projectId: input.projectId,
        customerId: input.customerId,
        prompt: input.prompt,
        generatedText: finalText,
        usedKnowledgeIds: knowledge.slice(0, 5).map(k => k.id),
      });

      return { text: finalText, usedKnowledge: knowledge.slice(0, 5) };
    }),
     markSent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await updateAiSession(input.id, { sentAsEmail: 1 as any, sentAt: new Date().toISOString() as any });
      return { success: true };
    }),
    // Vollwertiger Chat mit Gesprächsverlauf
    chat: protectedProcedure.input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
      includeErpContext: z.boolean().default(false),
    })).mutation(async ({ input }) => {
      // ERP-Kontext aufbauen wenn gewünscht
      let erpContext = "";
      if (input.includeErpContext) {
        const [customers, projects, invoices, suppliers] = await Promise.all([
          getCustomers(),
          getProjects(),
          getInvoices(),
          getSuppliers(),
        ]);
        const today = new Date().toLocaleDateString('de-DE');
        erpContext = `\n## ERP-Kontext (Stand: ${today})\n### Kunden (${customers.length})\n${customers.slice(0, 15).map((c: any) => `- ${c.company || c.name}${c.email ? ' | ' + c.email : ''}${c.phone ? ' | ' + c.phone : ''}`).join('\n')}\n### Projekte\n${projects.slice(0, 15).map((p: any) => `- [${p.status}] ${p.title}${p.projectNumber ? ' #' + p.projectNumber : ''}`).join('\n')}\n### Lieferanten (${suppliers.length})\n${suppliers.slice(0, 10).map((s: any) => `- ${s.name}${s.capabilities ? ' | ' + s.capabilities : ''}`).join('\n')}\n### Offene Rechnungen/Angebote\n${(invoices as any[]).filter((i: any) => ['draft','sent','overdue'].includes(i.status)).slice(0, 8).map((i: any) => `- ${i.invoiceNumber} | ${i.recipientName || i.recipientCompany || ''} | ${i.totalGross} € | ${i.status}`).join('\n')}\n`;
      }
      const systemPrompt = `Du bist ein intelligenter Assistent für Daniel Rincón, Geschäftsführer der Fabrica GmbH (3D-Druck, CNC, Oberflächenbehandlung, Modellbau, CAD-Bearbeitung).\nDu antwortest immer auf Deutsch, präzise und direkt.\nDu kannst bei Recherchen helfen, Fragen beantworten, Texte formulieren, Kalkulationen erklären und ERP-Daten auswerten.\nBei Tabellen und Listen nutze Markdown-Formatierung.${erpContext}`;
      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];
      const response = await invokeLLM({ messages: llmMessages });
      const rawContent = response.choices[0]?.message?.content;
      const reply = typeof rawContent === "string" ? rawContent : "Keine Antwort erhalten.";
      return { reply };
    }),
  }),

  // ─── Quick Notes ────────────────────────────────────────────────────────────
  quickNotes: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional().nullable() }).optional())
      .query(async ({ input }) => getQuickNotes(100, input?.projectId ?? undefined)),
    create: protectedProcedure.input(z.object({
      text: z.string().min(1),
      projectId: z.number().optional().nullable(),
      source: z.enum(["whatsapp", "telefon", "persoenlich", "email", "sonstiges"]).default("sonstiges"),
    })).mutation(async ({ input }) => {
      await createQuickNote(input);
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      text: z.string().min(1).optional(),
      source: z.enum(["whatsapp", "telefon", "persoenlich", "email", "sonstiges"]).optional(),
      remindAt: z.string().nullable().optional(),
      remindLabel: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateQuickNote(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteQuickNote(input.id);
      return { success: true };
    }),
    dueReminders: protectedProcedure.query(async () => getDueQuickNoteReminders()),
    markReminderSent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await markQuickNoteReminderSent(input.id);
      return { success: true };
    }),
  }),

  // ─── Notes & Reminders ──────────────────────────────────────────────────────
  notes: router({
    list: protectedProcedure
      .input(z.object({ status: z.string().optional(), projectId: z.number().optional().nullable() }).optional())
      .query(async ({ input }) => getNotes(input?.status, input?.projectId ?? undefined)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const note = await getNoteById(input.id);
        if (!note) throw new Error("Notiz nicht gefunden");
        const attachments = await getNoteAttachments(input.id);
        const reminders = await getNoteReminders(input.id);
        return { ...note, attachments, reminders };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        projectId: z.number().optional().nullable(),
        priority: z.enum(["niedrig", "normal", "hoch"]).default("normal"),
        source: z.enum(["whatsapp", "telefon", "email", "persoenlich", "sonstiges"]).optional(),
      }))
      .mutation(async ({ input }) => {
        await createNote(input);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(["offen", "erledigt"]).optional(),
        priority: z.enum(["niedrig", "normal", "hoch"]).optional(),
        source: z.enum(["whatsapp", "telefon", "email", "persoenlich", "sonstiges"]).optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateNote(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNote(input.id);
        return { success: true };
      }),

    // File upload for attachments
    uploadAttachment: protectedProcedure
      .input(z.object({
        noteId: z.number(),
        filename: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
        fileSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const ext = input.filename.split(".").pop() ?? "bin";
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `notes/${input.noteId}/${Date.now()}-${randomSuffix}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const fileType = input.mimeType.startsWith("image/") ? "image" :
          input.mimeType === "application/pdf" ? "pdf" : "other";
        await addNoteAttachment({
          noteId: input.noteId,
          filename: input.filename,
          fileUrl: url,
          fileKey,
          fileType,
          fileSize: input.fileSize,
        });
        return { success: true, url };
      }),

    deleteAttachment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNoteAttachment(input.id);
        return { success: true };
      }),

    addReminder: protectedProcedure
      .input(z.object({
        noteId: z.number(),
        label: z.string().optional(),
        remindAt: z.string(), // datetime-local string (YYYY-MM-DDTHH:MM) oder ISO
      }))
      .mutation(async ({ input }) => {
        await addNoteReminder({
          noteId: input.noteId,
          label: input.label,
          remindAt: input.remindAt, // String direkt übergeben, keine UTC-Konvertierung
        });
        return { success: true };
      }),

    deleteReminder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNoteReminder(input.id);
        return { success: true };
      }),

    pendingReminders: protectedProcedure.query(async () => getPendingReminders()),

    markReminderSent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markReminderSent(input.id);
        return { success: true };
      }),
  }),
  // ─── Supplier Offer Upload ────────────────────────────────────────────────────────────
  supplierOffer: router({
    upload: protectedProcedure.input(z.object({
      projectItemId: z.number(),
      filename: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    })).mutation(async ({ input }) => {
      const { projectItemId, filename, fileBase64, mimeType } = input;
      const buffer = Buffer.from(fileBase64, "base64");
      const key = `supplier-offers/${projectItemId}-${Date.now()}-${filename}`;
      const { url } = await storagePut(key, buffer, mimeType);
      await updateProjectItem(projectItemId, {
        supplierOfferUrl: url,
        supplierOfferKey: key,
        supplierOfferName: filename,
      } as any);
      return { url, key, filename };
    }),
    remove: protectedProcedure.input(z.object({ projectItemId: z.number() })).mutation(async ({ input }) => {
      await updateProjectItem(input.projectItemId, {
        supplierOfferUrl: null,
        supplierOfferKey: null,
        supplierOfferName: null,
      } as any);
      return { success: true };
    }),
  }),
  // ─── Complaints ───────────────────────────────────────────────────────────────
  complaints: router({
    list: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => getComplaintsByProject(input.projectId)),
    listAll: protectedProcedure.query(async () => getAllComplaints()),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(["open","in_progress","resolved","closed"]).default("open"),
      priority: z.enum(["low","normal","high","critical"]).default("normal"),
    })).mutation(async ({ input }) => { await createComplaint(input as any); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["open","in_progress","resolved","closed"]).optional(),
      priority: z.enum(["low","normal","high","critical"]).optional(),
      resolution: z.string().optional(),
      resolvedAt: z.string().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateComplaint(id, data as any); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteComplaint(input.id); return { success: true }; }),
    addAttachment: protectedProcedure.input(z.object({
      complaintId: z.number(),
      filename: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    })).mutation(async ({ input }) => {
      const { complaintId, filename, fileBase64, mimeType } = input;
      const buffer = Buffer.from(fileBase64, "base64");
      const key = `complaint-attachments/${complaintId}-${Date.now()}-${filename}`;
      const { url } = await storagePut(key, buffer, mimeType);
      await addComplaintAttachment({ complaintId, fileUrl: url, fileKey: key, filename, fileType: mimeType });
      return { url, key, filename };
    }),
    deleteAttachment: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteComplaintAttachment(input.id); return { success: true }; }),
  }),
  // ─── Invoices (GoBD-konform, §14 UStG) ──────────────────────────────────────────────────────────────────────────────
  invoices: router({
    list: protectedProcedure.input(z.object({ type: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ input }) => {
      return getInvoices(input ?? {});
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getInvoiceById(input.id);
    }),
    nextNumber: protectedProcedure.input(z.object({ type: z.enum(['invoice','offer','credit_note','order_confirmation','purchase_order','delivery_note']) })).query(async ({ input }) => {
      // Nur Vorschau, keine Reservierung
      return { preview: true };
    }),
    create: protectedProcedure.input(z.object({
      type: z.enum(['offer','invoice','credit_note','order_confirmation','purchase_order','delivery_note']).default('offer'),
      customerId: z.number().optional(),
      supplierId: z.number().optional(),
      projectId: z.number().optional(),
      senderName: z.string().optional(),
      senderStreet: z.string().optional(),
      senderZip: z.string().optional(),
      senderCity: z.string().optional(),
      senderTaxId: z.string().optional(),
      senderVatId: z.string().optional(),
      senderEmail: z.string().optional(),
      senderPhone: z.string().optional(),
      senderIban: z.string().optional(),
      senderBic: z.string().optional(),
      recipientName: z.string().optional(),
      recipientCompany: z.string().optional(),
      recipientStreet: z.string().optional(),
      recipientZip: z.string().optional(),
      recipientCity: z.string().optional(),
      recipientEmail: z.string().optional(),
      issueDate: z.string().optional(),
      dueDate: z.string().optional(),
      deliveryDate: z.string().optional(),
      paymentTerms: z.string().optional(),
      taxMode: z.enum(['standard','reduced','mixed','tax_free','kleinunternehmer']).optional(),
      subtotalNet: z.string().optional(),
      taxAmount: z.string().optional(),
      totalGross: z.string().optional(),
      introText: z.string().optional(),
      notes: z.string().optional(),
      footerText: z.string().optional(),
      items: z.array(z.object({
        position: z.number(),
        description: z.string(),
        quantity: z.string().optional(),
        unit: z.string().optional(),
        unitPriceNet: z.string(),
        taxRate: z.string().optional(),
        lineTotalNet: z.string().optional(),
        lineTax: z.string().optional(),
        lineTotalGross: z.string().optional(),
        longDescription: z.string().optional(),
        isOptional: z.boolean().optional(),
        discount: z.string().optional(),
        discountedNet: z.string().optional(),
      })).default([]),
    })).mutation(async ({ input, ctx }) => {
      const { items, ...invoiceData } = input;
      // Rechnungen, Gutschriften und Auftragsbestätigungen bekommen die Nummer erst beim Senden (nicht beim Erstellen als Entwurf)
      // Angebote, Bestellungen und Lieferscheine bekommen die Nummer sofort
      const needsNumberOnSend = ['invoice', 'credit_note', 'order_confirmation'].includes(input.type);
      const invoiceNumber = needsNumberOnSend ? 'ENTWURF' : await getNextInvoiceNumber(input.type);
      const mappedItems = items.map(it => ({
        ...it,
        isOptional: it.isOptional ? 1 : 0,
      }));
      const id = await createInvoice(
        { ...invoiceData as any, invoiceNumber },
        mappedItems as any,
        ctx.user.email ?? 'system',
      );
      // Projektstatus automatisch auf 'offer' setzen wenn Angebot mit Projektbezug
      if (input.type === 'offer' && input.projectId) {
        const project = await getProjectById(input.projectId);
        const STATUS_ORDER = ['inquiry', 'calculation', 'offer', 'order', 'production', 'shipping', 'completed', 'cancelled'];
        const currentIdx = STATUS_ORDER.indexOf(project?.status ?? 'inquiry');
        const offerIdx = STATUS_ORDER.indexOf('offer');
        // Nur hochstufen, nie zurückstufen
        if (project && currentIdx < offerIdx) {
          await updateProject(input.projectId, { status: 'offer' });
        }
      }
      return { id, invoiceNumber };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      customerId: z.number().optional(),
      supplierId: z.number().optional(),
      projectId: z.number().optional(),
      senderName: z.string().optional(),
      senderStreet: z.string().optional(),
      senderZip: z.string().optional(),
      senderCity: z.string().optional(),
      senderTaxId: z.string().optional(),
      senderVatId: z.string().optional(),
      senderEmail: z.string().optional(),
      senderPhone: z.string().optional(),
      senderIban: z.string().optional(),
      senderBic: z.string().optional(),
      recipientName: z.string().optional(),
      recipientCompany: z.string().optional(),
      recipientStreet: z.string().optional(),
      recipientZip: z.string().optional(),
      recipientCity: z.string().optional(),
      recipientEmail: z.string().optional(),
      issueDate: z.string().optional(),
      dueDate: z.string().optional(),
      deliveryDate: z.string().optional(),
      paymentTerms: z.string().optional(),
      taxMode: z.enum(['standard','reduced','mixed','tax_free','kleinunternehmer']).optional(),
      subtotalNet: z.string().optional(),
      taxAmount: z.string().optional(),
      totalGross: z.string().optional(),
      introText: z.string().optional(),
      notes: z.string().optional(),
      footerText: z.string().optional(),
      items: z.array(z.object({
        position: z.number(),
        description: z.string(),
        quantity: z.string().optional(),
        unit: z.string().optional(),
        unitPriceNet: z.string(),
        taxRate: z.string().optional(),
        lineTotalNet: z.string().optional(),
        lineTax: z.string().optional(),
        lineTotalGross: z.string().optional(),
        longDescription: z.string().optional(),
        isOptional: z.boolean().optional(),
        discount: z.string().optional(),
        discountedNet: z.string().optional(),
      })).optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, items, ...data } = input;
      const mappedItems = items
        ? items.map(it => ({ ...it, isOptional: it.isOptional ? 1 : 0 }))
        : null;
      await updateInvoice(id, data as any, mappedItems as any, ctx.user.email ?? 'system');
      return { id, success: true };
    }),
    changeStatus: protectedProcedure.input(z.object({ id: z.number(), status: z.string() })).mutation(async ({ input, ctx }) => {
      // Wenn Rechnung/Gutschrift/AB vom Entwurf in aktiven Status wechselt → Nummer jetzt vergeben
      if (input.status !== 'draft') {
        await assignInvoiceNumber(input.id);
      }
      await changeInvoiceStatus(input.id, input.status, ctx.user.email ?? 'system');
      return { success: true };
    }),
    lock: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      // PDF-URL wird nach PDF-Generierung gesetzt; hier zunächst ohne PDF sperren
      await lockInvoice(input.id, '', '', ctx.user.email ?? 'system');
      return { success: true };
    }),
    cancel: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await cancelInvoice(input.id, ctx.user.email ?? 'system');
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteInvoiceDraft(input.id);
      return { success: true };
    }),
    auditLog: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getInvoiceAuditLog(input.id);
    }),
    exportCsv: protectedProcedure.input(z.object({ type: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ input }) => {
      const all = await getInvoices(input ?? {});
      // CSV-Header
      const header = 'Nummer;Typ;Status;Empfänger;Datum;Fälligkeit;Netto;MwSt;Brutto;Währung';
      const rows = all.map(inv => [
        inv.invoiceNumber,
        inv.type === 'invoice' ? 'Rechnung' : inv.type === 'offer' ? 'Angebot' : 'Gutschrift',
        inv.status,
        [inv.recipientCompany, inv.recipientName].filter(Boolean).join(' / '),
        inv.issueDate ?? '',
        inv.dueDate ?? '',
        inv.subtotalNet ?? '0',
        inv.taxAmount ?? '0',
        inv.totalGross ?? '0',
        inv.currency ?? 'EUR',
      ].join(';'));
      return { csv: [header, ...rows].join('\n') };
    }),
    exportDatev: protectedProcedure.input(z.object({ year: z.number().optional() }).optional()).query(async ({ input }) => {
      const year = input?.year ?? new Date().getFullYear();
      const all = await getInvoices({ type: 'invoice' });
      const filtered = all.filter(inv => inv.issueDate?.startsWith(String(year)));
      // DATEV Buchungsstapel (vereinfacht)
      const header = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Buchungstext';
      const rows = filtered.map(inv => [
        (parseFloat(String(inv.totalGross ?? 0))).toFixed(2).replace('.', ','),
        'H',
        'EUR',
        '',
        (parseFloat(String(inv.subtotalNet ?? 0))).toFixed(2).replace('.', ','),
        'EUR',
        '8400',
        '10000',
        '',
        inv.issueDate?.replace(/-/g, '').slice(4) ?? '',
        inv.invoiceNumber,
        [inv.recipientCompany, inv.recipientName].filter(Boolean).join(' '),
      ].join(';'));
      return { csv: [header, ...rows].join('\n'), filename: `DATEV-${year}.csv` };
    }),
    convert: protectedProcedure
      .input(z.object({
        offerId: z.number(),
        targetType: z.enum(['invoice', 'order_confirmation', 'purchase_order', 'delivery_note']),
      }))
      .mutation(async ({ input, ctx }) => {
        // Angebot laden
        const offer = await getInvoiceById(input.offerId);
        if (!offer) throw new Error('Angebot nicht gefunden');
        if (offer.type !== 'offer') throw new Error('Nur Angebote können konvertiert werden');
        // Neue Nummer vergeben
        const invoiceNumber = await getNextInvoiceNumber(input.targetType);
        const today = new Date().toISOString().slice(0, 10);
        // Fälligkeitsdatum: heute + 14 Tage (nur bei Rechnung relevant)
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Neues Dokument aus Angebotsdaten erstellen
        const invoiceData: any = {
          invoiceNumber,
          type: input.targetType as any,
          status: 'draft' as const,
          customerId: offer.customerId,
          projectId: offer.projectId,
          senderName: offer.senderName,
          senderStreet: offer.senderStreet,
          senderZip: offer.senderZip,
          senderCity: offer.senderCity,
          senderTaxId: offer.senderTaxId,
          senderVatId: offer.senderVatId,
          senderEmail: offer.senderEmail,
          senderPhone: offer.senderPhone,
          senderIban: offer.senderIban,
          senderBic: offer.senderBic,
          recipientName: offer.recipientName,
          recipientCompany: offer.recipientCompany,
          recipientStreet: offer.recipientStreet,
          recipientZip: offer.recipientZip,
          recipientCity: offer.recipientCity,
          recipientEmail: offer.recipientEmail,
          issueDate: today,
          dueDate: input.targetType === 'invoice' ? dueDate : null,
          deliveryDate: input.targetType === 'delivery_note' ? today : offer.deliveryDate,
          paymentTerms: input.targetType === 'delivery_note' ? null : offer.paymentTerms,
          taxMode: offer.taxMode,
          subtotalNet: input.targetType === 'delivery_note' ? null : offer.subtotalNet,
          taxAmount: input.targetType === 'delivery_note' ? null : offer.taxAmount,
          totalGross: input.targetType === 'delivery_note' ? null : offer.totalGross,
          currency: offer.currency,
          introText: input.targetType === 'delivery_note'
            ? `Lieferschein zu Angebot ${offer.invoiceNumber}`
            : offer.introText,
          notes: offer.notes,
          footerText: offer.footerText,
        };
        const items = (offer.items ?? []).map((item: any) => ({
          invoiceId: 0, // wird in createInvoice überschrieben
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceNet: input.targetType === 'delivery_note' ? '0' : item.unitPriceNet,
          taxRate: input.targetType === 'delivery_note' ? '0' : item.taxRate,
          lineTotalNet: input.targetType === 'delivery_note' ? '0' : item.lineTotalNet,
          lineTax: input.targetType === 'delivery_note' ? '0' : item.lineTax,
          lineTotalGross: input.targetType === 'delivery_note' ? '0' : item.lineTotalGross,
          longDescription: item.longDescription,
          isOptional: 0,
          discount: input.targetType === 'delivery_note' ? null : item.discount,
          discountedNet: input.targetType === 'delivery_note' ? null : item.discountedNet,
        }));
        const newId = await createInvoice(invoiceData, items, ctx.user.email ?? 'system');
        // Angebot-Status setzen (bei Lieferschein bleibt Angebot auf 'accepted')
        const newStatus = input.targetType === 'invoice' ? 'invoiced' : 'accepted';
        await changeInvoiceStatus(input.offerId, newStatus, ctx.user.email ?? 'system');
        return { id: newId, invoiceNumber };
      }),
    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const original = await getInvoiceById(input.id);
        if (!original) throw new Error('Dokument nicht gefunden');
        // Neue Nummer vergeben (gleicher Typ)
        const invoiceNumber = await getNextInvoiceNumber(original.type);
        const today = new Date().toISOString().slice(0, 10);
        const copyData: any = {
          invoiceNumber,
          type: original.type,
          status: 'draft' as const,
          customerId: original.customerId,
          projectId: original.projectId,
          senderName: original.senderName,
          senderStreet: original.senderStreet,
          senderZip: original.senderZip,
          senderCity: original.senderCity,
          senderTaxId: original.senderTaxId,
          senderVatId: original.senderVatId,
          senderEmail: original.senderEmail,
          senderPhone: original.senderPhone,
          senderIban: original.senderIban,
          senderBic: original.senderBic,
          recipientName: original.recipientName,
          recipientCompany: original.recipientCompany,
          recipientStreet: original.recipientStreet,
          recipientZip: original.recipientZip,
          recipientCity: original.recipientCity,
          recipientEmail: original.recipientEmail,
          issueDate: today,
          dueDate: original.dueDate,
          deliveryDate: original.deliveryDate,
          paymentTerms: original.paymentTerms,
          taxMode: original.taxMode,
          subtotalNet: original.subtotalNet,
          taxAmount: original.taxAmount,
          totalGross: original.totalGross,
          currency: original.currency,
          introText: original.introText,
          notes: original.notes,
          footerText: original.footerText,
          discount: (original as any).discount ?? null,
          discountType: (original as any).discountType ?? null,
          discountValue: (original as any).discountValue ?? null,
        };
        const items = (original.items ?? []).map((item: any) => ({
          invoiceId: 0,
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceNet: item.unitPriceNet,
          taxRate: item.taxRate,
          lineTotalNet: item.lineTotalNet,
          lineTax: item.lineTax,
          lineTotalGross: item.lineTotalGross,
          longDescription: item.longDescription,
          isOptional: item.isOptional ?? 0,
          discount: item.discount,
          discountedNet: item.discountedNet,
        }));
        const newId = await createInvoice(copyData, items, ctx.user.email ?? 'system');
        return { id: newId, invoiceNumber };
      }),
    generatePdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const inv = await getInvoiceById(input.id);
        if (!inv) throw new Error('Dokument nicht gefunden');
        const cs = await getCompanySettings();
        const pdfBuffer = await renderInvoicePdf(inv, cs);
        const filename = inv.invoiceNumber + '.pdf';

        // Automatisch in Google Drive hochladen wenn Angebot einem Projekt zugeordnet ist
        let driveFileId: string | null = null;
        if ((inv as any).projectId) {
          try {
            const project = await getProjectById((inv as any).projectId);
            if (project) {
              const customer = (project as any).customerId ? await getCustomerById((project as any).customerId) : null;
              const { uploadFileToDrive } = await import('./googleDrive');
              const projectName = (project as any).projectNumber
                ? `${(project as any).projectNumber} ${project.title}`.substring(0, 100)
                : project.title.substring(0, 100);
              const driveResult = await uploadFileToDrive({
                filename,
                mimeType: 'application/pdf',
                buffer: pdfBuffer,
                customerName: customer ? ((customer as any).company || (customer as any).name) : 'Unbekannt',
                projectName,
              });
              driveFileId = driveResult.fileId;
            }
          } catch (e) {
            // Drive-Upload-Fehler blockieren den PDF-Download nicht
            console.error('[generatePdf] Drive-Upload fehlgeschlagen:', e);
          }
        }

        return { pdf: pdfBuffer.toString('base64'), filename, driveFileId };
      }),

    exportZip: protectedProcedure
      .input(z.object({
        year: z.number().int().min(2020).max(2099),
        month: z.number().int().min(0).max(12).optional(), // 0 = ganzes Jahr, 1-12 = Monat
        types: z.array(z.string()).optional(), // ['invoice','offer','purchase_order','credit_note'] oder leer = alle
      }))
      .mutation(async ({ input }) => {
        // Alle Rechnungen laden
        const allInvoices = await getInvoices();
        const cs = await getCompanySettings();

        // Filtern nach Jahr/Monat/Typ
        const filtered = allInvoices.filter((inv: any) => {
          // issueDate ist ein String wie "2026-03-20", createdAt ist ein Unix-Timestamp in ms
          let d: Date;
          if (inv.issueDate && typeof inv.issueDate === 'string' && inv.issueDate.length >= 4) {
            d = new Date(inv.issueDate);
          } else if (inv.createdAt) {
            d = new Date(inv.createdAt);
          } else {
            return false;
          }
          if (isNaN(d.getTime())) return false;
          const invYear = d.getFullYear();
          const invMonth = d.getMonth() + 1; // 1-12
          if (invYear !== input.year) return false;
          if (input.month && input.month > 0 && invMonth !== input.month) return false;
          if (input.types && input.types.length > 0 && !input.types.includes(inv.type)) return false;
          return true;
        });

        if (filtered.length === 0) {
          throw new Error('Keine Dokumente für den gewählten Zeitraum gefunden');
        }

        // ZIP erstellen
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          const archive = archiver('zip', { zlib: { level: 6 } });
          archive.on('data', (chunk: Buffer) => chunks.push(chunk));
          archive.on('end', () => resolve());
          archive.on('error', reject);

          // PDFs generieren und zum ZIP hinzufügen
          const pdfPromises = filtered.map(async (inv: any) => {
            try {
              const fullInv = await getInvoiceById(inv.id);
              if (!fullInv) return;
              const pdfBuffer = await renderInvoicePdf(fullInv, cs);
              archive.append(pdfBuffer, { name: `${inv.invoiceNumber}.pdf` });
            } catch (e) {
              // Einzelne Fehler überspringen
            }
          });

          Promise.all(pdfPromises).then(() => archive.finalize()).catch(reject);
        });

        const zipBuffer = Buffer.concat(chunks);
        const monthStr = input.month && input.month > 0
          ? `-${String(input.month).padStart(2, '0')}`
          : '';
        const filename = `Dokumente-${input.year}${monthStr}.zip`;

        return {
          zip: zipBuffer.toString('base64'),
          filename,
          count: filtered.length,
        };
      }),
  }),
  // ─── KI-Textverbesserung ──────────────────────────────────────────────────────────────────────────────
  textImprove: router({
    improve: protectedProcedure
      .input(z.object({
        text: z.string().min(1),
        mode: z.enum(['improve', 'correct']).default('improve'),
        context: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = input.mode === 'correct'
          ? `Du bist ein professioneller Lektor für deutsche Geschäftstexte. Korrigiere den folgenden Text: Rechtschreibung, Grammatik und Zeichensetzung. Gib NUR den korrigierten Text zurück, ohne Erklärungen, ohne Anführungszeichen, ohne Kommentare. Behalte die ursprüngliche Bedeutung und Struktur exakt bei. Verwende keine Gedankenstriche.`
          : `Du bist ein professioneller Texter für deutsche Geschäftstexte im Bereich 3D-Druck und Fertigung. Formuliere den folgenden Text professionell und klar um. Gib NUR den verbesserten Text zurück, ohne Erklärungen, ohne Anführungszeichen, ohne Kommentare. Behalte die Kernaussage bei. Verwende keine Gedankenstriche. Kontext: ${input.context ?? 'Geschäftsdokument'}.`;
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.text },
          ],
        });
        const improved = (response as any)?.choices?.[0]?.message?.content ?? input.text;
        return { improved: improved.trim() };
      }),
  }),
  // ─── Company Settings ─────────────────────────────────────────────────────────────────────────────────
  companySettings: router({
    get: protectedProcedure.query(async () => {
      return getCompanySettings();
    }),
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        legalForm: z.string().optional(),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        website: z.string().optional(),
        taxNumber: z.string().optional(),
        vatId: z.string().optional(),
        iban: z.string().optional(),
        bic: z.string().optional(),
        bankName: z.string().optional(),
        invoiceFooter: z.string().optional(),
        // 4-spaltige Fußzeile
        footerCol1: z.string().optional(),
        footerCol2: z.string().optional(),
        footerCol3: z.string().optional(),
        footerCol4: z.string().optional(),
        kleinunternehmer: z.boolean().optional(),
        // Nummernkreis
        offerPrefix: z.string().max(20).optional(),
        invoicePrefix: z.string().max(20).optional(),
        creditNotePrefix: z.string().max(20).optional(),
        numberSeparator: z.string().max(5).optional(),
        numberPadding: z.number().int().min(1).max(8).optional(),
        includeYear: z.boolean().optional(),
        // Startnummern (für Migration von Sevdesk etc.)
        offerStartNumber: z.number().int().min(1).optional(),
        invoiceStartNumber: z.number().int().min(1).optional(),
        creditNoteStartNumber: z.number().int().min(1).optional(),
        customerStartNumber: z.number().int().min(1).optional(),
        // AGB
        agbText: z.string().optional(),
        // SMTP
        smtpHost: z.string().optional(),
        smtpPort: z.number().int().optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        smtpFrom: z.string().optional(),
        smtpSecure: z.boolean().optional(),
        emailSignature: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return upsertCompanySettings({
          ...input,
          kleinunternehmer: input.kleinunternehmer !== undefined ? (input.kleinunternehmer ? 1 : 0) : undefined,
          includeYear: input.includeYear !== undefined ? (input.includeYear ? 1 : 0) : undefined,
          smtpSecure: input.smtpSecure !== undefined ? (input.smtpSecure ? 1 : 0) : undefined,
        } as any);
      }),
    // SMTP-Verbindungstest
    testSmtp: protectedProcedure
      .input(z.object({
        smtpHost: z.string(),
        smtpPort: z.number().int(),
        smtpUser: z.string(),
        smtpPass: z.string(),
        smtpFrom: z.string(),
        smtpSecure: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const { sendEmail } = await import('./email');
        const result = await sendEmail({
          ...input,
          to: input.smtpUser,
          subject: 'Fabrica ERP – SMTP-Test',
          html: '<p>SMTP-Verbindungstest erfolgreich. Diese E-Mail wurde automatisch generiert.</p>',
        });
        return result;
      }),
    // Angebot per E-Mail versenden
    sendOfferEmail: protectedProcedure
      .input(z.object({
        invoiceId: z.number(),
        to: z.string().email(),
        cc: z.string().optional(),
        subject: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { getCompanySettings } = await import('./db');
        const { getInvoiceById } = await import('./db');
        const { sendEmail, buildOfferEmailHtml } = await import('./email');
        const cs = await getCompanySettings();
        if (!cs?.smtpHost || !cs?.smtpUser || !cs?.smtpPass) {
          throw new Error('SMTP nicht konfiguriert. Bitte SMTP-Einstellungen in den Firmen-Einstellungen hinterlegen.');
        }
        const inv = await getInvoiceById(input.invoiceId);
        if (!inv) throw new Error('Angebot nicht gefunden');
        const html = buildOfferEmailHtml({
          invoiceNumber: inv.invoiceNumber ?? '',
          recipientName: inv.recipientName ?? undefined,
          recipientCompany: inv.recipientCompany ?? undefined,
          senderName: inv.senderName ?? undefined,
          emailBody: input.body,
          emailSignature: cs.emailSignature ?? undefined,
          totalGross: inv.totalGross ?? undefined,
          issueDate: inv.issueDate ?? undefined,
          validUntil: inv.dueDate ?? undefined,
        });
        const result = await sendEmail({
          smtpHost: cs.smtpHost,
          smtpPort: cs.smtpPort ?? 587,
          smtpUser: cs.smtpUser,
          smtpPass: cs.smtpPass,
          smtpFrom: cs.smtpFrom ?? cs.smtpUser,
          smtpSecure: Boolean(cs.smtpSecure),
          to: input.to,
          cc: input.cc,
          subject: input.subject,
          html,
        });
        if (!result.success) throw new Error(result.error ?? 'E-Mail-Versand fehlgeschlagen');
        // sentAsEmail-Flag setzen (sofern vorhanden)
        return { success: true, messageId: result.messageId };
      }),

    // ─── Gmail-Entwurf vorbereiten: PDF generieren + S3 hochladen + Entwurfsdaten zurückgeben ───
    prepareGmailDraft: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .mutation(async ({ input }) => {
        const inv = await getInvoiceById(input.invoiceId);
        if (!inv) throw new Error('Angebot nicht gefunden');
        const cs = await getCompanySettings();

        // PDF generieren und auf S3 hochladen
        const pdfBuffer = await renderInvoicePdf(inv, cs);
        const fileKey = `gmail-drafts/${inv.invoiceNumber}-${Date.now()}.pdf`;
        const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, 'application/pdf');

        // E-Mail-Metadaten vorbereiten
        const invoiceNumber = inv.invoiceNumber ?? '';
        const recipientCompany = inv.recipientCompany ?? '';
        const recipientName = inv.recipientName ?? '';
        const issueDate = inv.issueDate ?? new Date().toLocaleDateString('de-DE');
        const senderName = cs?.ownerName ?? 'Daniel Rincón';
        const companyName = cs?.name ?? 'Fabrica GmbH';
        const companyPhone = cs?.phone ?? '+49(0)2273-9529429';
        const companyMobile = cs?.mobile ?? '+49(0)170/8342238';
        const companyEmail = cs?.email ?? 'd.rincon@fabrica3d.eu';
        const companyWebsite = cs?.website ?? 'www.fabrica3d.de';
        const companyStreet = cs?.street ?? 'Hüttenstraße 205';
        const companyCity = [cs?.zip, cs?.city].filter(Boolean).join(' ') || '50170 Kerpen-Sindorf';

        const salutation = recipientName
          ? `Sehr geehrte${recipientName.toLowerCase().includes('herr') ? 'r' : ''} ${recipientName},`
          : recipientCompany
          ? `Sehr geehrte Damen und Herren,`
          : `Sehr geehrte Damen und Herren,`;

        const emailBody = `${salutation}

im Anhang übersende ich Ihnen unser Angebot ${invoiceNumber} vom ${issueDate}.

Bei Rückfragen stehe ich Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen

${senderName}

${companyName}
${companyStreet}
${companyCity}

Tel.: ${companyPhone}
Mobil: ${companyMobile}
${companyEmail}
${companyWebsite}

---
Diese Nachricht ist ausschließlich für den oben bezeichneten Adressaten bestimmt und enthält möglicherweise vertrauliche Informationen. Sollten Sie nicht der oben bezeichnete Adressat sein oder diese Nachricht irrtümlich erhalten haben, ersuchen wir Sie diese Nachricht nicht weiterzugeben, zu kopieren oder im Vertrauen darauf zu handeln, sondern uns unter ${companyEmail} zu verständigen und diese Nachricht sofort zu löschen.`;

        const subject = recipientCompany
          ? `Angebot ${invoiceNumber} für ${recipientCompany}`
          : `Angebot ${invoiceNumber}`;

        return {
          success: true,
          pdfUrl,
          pdfFilename: `${invoiceNumber}.pdf`,
          pdfBase64: pdfBuffer.toString('base64'),
          to: inv.recipientEmail ?? '',
          subject,
          body: emailBody,
          invoiceNumber,
          recipientCompany,
          recipientName,
        };
      }),

    numberPreview: protectedProcedure
      .input(z.object({
        type: z.enum(['offer', 'invoice', 'credit_note']),
        offerPrefix: z.string().optional(),
        invoicePrefix: z.string().optional(),
        creditNotePrefix: z.string().optional(),
        numberSeparator: z.string().optional(),
        numberPadding: z.number().int().min(1).max(8).optional(),
        includeYear: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const year = new Date().getFullYear();
        const sep = input.numberSeparator ?? '-';
        const padding = input.numberPadding ?? 4;
        const includeYear = input.includeYear ?? true;
        const prefix = input.type === 'invoice'
          ? (input.invoicePrefix ?? 'RE')
          : input.type === 'offer'
            ? (input.offerPrefix ?? 'AN')
            : (input.creditNotePrefix ?? 'GS');
        const paddedNum = '1'.padStart(padding, '0');
        const preview = includeYear
          ? `${prefix}${sep}${year}${sep}${paddedNum}`
          : `${prefix}${sep}${paddedNum}`;
        return { preview };
      }),
    uploadLogo: protectedProcedure
      .input(z.object({ base64: z.string(), mimeType: z.string(), filename: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, 'base64');
        const key = `company/logo-${Date.now()}.${input.filename.split('.').pop()}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await upsertCompanySettings({ logoUrl: url, logoKey: key });
        return { url };
      }),
  }),
  // ─── Kalender ──────────────────────────────────────────────────────────────────────────────────────
  calendar: router({
    list: protectedProcedure
      .input(z.object({ from: z.number(), to: z.number() }))
      .query(async ({ input }) => listCalendarEvents(input.from, input.to)),

     create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startAt: z.number(),
        endAt: z.number(),
        allDay: z.boolean().optional(),
        category: z.enum(['customer', 'project', 'invoice', 'personal', 'other']).optional(),
        color: z.string().optional(),
        location: z.string().optional(),
        customerId: z.number().optional(),
        projectId: z.number().optional(),
        googleEventId: z.string().optional(),
        reminder1Min: z.number().nullable().optional(),
        reminder2Min: z.number().nullable().optional(),
        reminder3Min: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await createCalendarEvent({
          ...input,
          allDay: input.allDay ? 1 : 0,
          createdBy: ctx.user.id,
          reminderSent: 0,
        });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startAt: z.number().optional(),
        endAt: z.number().optional(),
        allDay: z.boolean().optional(),
        category: z.enum(['customer', 'project', 'invoice', 'personal', 'other']).optional(),
        color: z.string().optional(),
        location: z.string().optional(),
        customerId: z.number().optional(),
        projectId: z.number().optional(),
        googleEventId: z.string().optional(),
        reminder1Min: z.number().nullable().optional(),
        reminder2Min: z.number().nullable().optional(),
        reminder3Min: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, allDay, ...rest } = input;
        await updateCalendarEvent(id, { ...rest, ...(allDay !== undefined ? { allDay: allDay ? 1 : 0 } : {}), reminderSent: 0 });
        return { success: true };
      }),
    checkReminders: protectedProcedure
      .mutation(async () => {
        const db = await (await import('./db')).getDb();
        if (!db) return { notified: 0 };
        const { calendarEvents: calEventsTable } = await import('../drizzle/schema');
        const { and, gt, lte, eq, or, isNotNull } = await import('drizzle-orm');
        const now = Date.now();
        const lookahead = now + 8 * 24 * 60 * 60 * 1000; // 8 Tage voraus
        const events = await db.select().from(calEventsTable)
          .where(and(
            gt(calEventsTable.startAt, now),
            lte(calEventsTable.startAt, lookahead),
            eq(calEventsTable.reminderSent, 0),
            or(isNotNull(calEventsTable.reminder1Min), isNotNull(calEventsTable.reminder2Min), isNotNull(calEventsTable.reminder3Min))
          ));
        const { notifyOwner } = await import('./_core/notification');
        let notified = 0;
        for (const ev of events) {
          const reminders = [ev.reminder1Min, ev.reminder2Min, ev.reminder3Min].filter((r): r is number => r !== null && r !== undefined);
          for (const minBefore of reminders) {
            const triggerAt = ev.startAt - minBefore * 60 * 1000;
            if (triggerAt <= now && triggerAt > now - 5 * 60 * 1000) {
              const label = minBefore >= 10080 ? '1 Woche' : minBefore >= 1440 ? '1 Tag' : `${minBefore} Minuten`;
              await notifyOwner({
                title: `⏰ Erinnerung: ${ev.title}`,
                content: `Termin beginnt in ${label}: ${ev.title}\n${ev.location ? 'Ort: ' + ev.location : ''}\n${new Date(ev.startAt).toLocaleString('de-DE')}`,
              });
              notified++;
              await db.update(calEventsTable).set({ reminderSent: 1 }).where(eq(calEventsTable.id, ev.id));
              break;
            }
          }
        }
        return { notified };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCalendarEvent(input.id);
        return { success: true };
      }),

    syncFromGoogle: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
      .mutation(async ({ ctx }) => {
        const { execSync } = await import('child_process');
        const { readFileSync } = await import('fs');
        const now = new Date();
        const timeMin = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();
        const timeMax = new Date(now.getTime() + 60 * 24 * 3600000).toISOString();
        // MCP Google Calendar abfragen
        let googleEvents: any[] = [];
        try {
          const mcpInput = JSON.stringify({ calendar_id: 'primary', time_min: timeMin, time_max: timeMax, max_results: 100 });
          const stdout = execSync(
            `manus-mcp-cli tool call google_calendar_search_events --server google-calendar --input '${mcpInput}'`,
            { encoding: 'utf8', timeout: 30000 }
          );
          // manus-mcp-cli schreibt das Ergebnis in eine JSON-Datei unter /tmp/manus-mcp/
          // Die Datei wird im stdout als Pfad ausgegeben
          const fileMatch = stdout.match(/\/tmp\/manus-mcp\/[^\s]+\.json/);
          if (fileMatch) {
            const resultJson = JSON.parse(readFileSync(fileMatch[0], 'utf8'));
            if (resultJson.result && Array.isArray(resultJson.result)) {
              googleEvents = resultJson.result;
            }
          }
        } catch (e: any) {
          throw new Error('Google Calendar MCP Fehler: ' + e.message);
        }
        if (!Array.isArray(googleEvents)) googleEvents = [];
        // Bestehende Google-Events im ERP holen
        const db = await (await import('./db')).getDb();
        if (!db) return { synced: 0, updated: 0, message: 'DB nicht verfügbar' };
        const { calendarEvents: calEventsTable } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const existing = await db.select({ id: calEventsTable.id, googleEventId: calEventsTable.googleEventId })
          .from(calEventsTable)
          .where(eq(calEventsTable.createdBy, ctx.user.id));
        const existingMap = new Map(
          existing
            .filter((e): e is { id: number; googleEventId: string } => !!e.googleEventId)
            .map(e => [e.googleEventId, e.id] as [string, number])
        );
        let synced = 0, updated = 0;
        for (const ev of googleEvents) {
          if (!ev.id || !ev.summary) continue;
          const startAt: number | null = ev.start?.dateTime ? new Date(ev.start.dateTime).getTime()
            : ev.start?.date ? new Date(ev.start.date).getTime() : null;
          const endAt: number | null = ev.end?.dateTime ? new Date(ev.end.dateTime).getTime()
            : ev.end?.date ? new Date(ev.end.date).getTime() : null;
          if (!startAt || !endAt) continue;
          const allDay = !ev.start?.dateTime ? 1 : 0;
          const data = {
            title: ev.summary as string,
            description: (ev.description as string) || null,
            startAt,
            endAt,
            allDay,
            location: (ev.location as string) || null,
            googleEventId: ev.id as string,
            category: 'other' as const,
            color: '#10b981',
            createdBy: ctx.user.id,
          };
          if (existingMap.has(ev.id as string)) {
            const existingId = existingMap.get(ev.id as string)!;
            await updateCalendarEvent(existingId, data);
            updated++;
          } else {
            await createCalendarEvent({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
            synced++;
          }
        }
        return { synced, updated, total: googleEvents.length, message: `${synced} neu importiert, ${updated} aktualisiert` };
      }),
    syncToGoogle: protectedProcedure
      .input(z.object({ eventId: z.number() }))
      .mutation(async ({ input }) => {
        const { execSync } = await import('child_process');
        const ev = await getCalendarEvent(input.eventId);
        if (!ev) throw new Error('Termin nicht gefunden');
        const startIso = new Date(ev.startAt).toISOString();
        const endIso = new Date(ev.endAt).toISOString();
        const payload = {
          calendar_id: 'primary',
          summary: ev.title,
          description: ev.description || '',
          start_time: startIso,
          end_time: endIso,
          location: ev.location || '',
        };
        try {
          execSync(
            `manus-mcp-cli tool call google_calendar_create_events --server google-calendar --input '${JSON.stringify(payload)}'`,
            { encoding: 'utf8', timeout: 30000 }
          );
        } catch (e: any) {
          throw new Error('Google Calendar Export Fehler: ' + e.message);
        }
        return { success: true };
      }),
  }),
  // ─── Data Export ────────────────────────────────────────────────────────────────────────────────────
  dataExport: router({
    full: protectedProcedure.query(async () => getFullExport()),
  }),

  // ─── Projekt-Dokumente ────────────────────────────────────────────────────────────────
  projectDocs: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) return [];
        const { projectDocuments } = await import('../drizzle/schema');
        const { eq, desc } = await import('drizzle-orm');
        return db.select().from(projectDocuments)
          .where(eq(projectDocuments.projectId, input.projectId))
          .orderBy(desc(projectDocuments.createdAt));
      }),

    upload: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        supplierId: z.number().nullable().optional(),
        customerId: z.number().nullable().optional(),
        category: z.enum(['supplier_offer','nda','order','delivery_note','invoice','contract','drawing','cad_data','photo','protocol','rendering','other']).default('other'),
        filename: z.string(),
        fileBase64: z.string(),
        mimeType: z.string().default('application/octet-stream'),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { projectDocuments } = await import('../drizzle/schema');
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const fileKey = `project-docs/${input.projectId}/${input.category}/${Date.now()}-${input.filename}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await db.insert(projectDocuments).values({
          projectId: input.projectId,
          supplierId: input.supplierId ?? null,
          customerId: input.customerId ?? null,
          category: input.category,
          filename: input.filename,
          fileKey,
          fileUrl: url,
          fileSize: buffer.length,
          mimeType: input.mimeType,
          notes: input.notes ?? null,
          uploadedBy: ctx.user.name ?? 'Unknown',
          createdAt: Date.now(),
        });
        // Auto-Sync nach Google Drive (im Hintergrund)
        try {
          const project = await getProjectById(input.projectId);
          const { getSupplierById: getSupplierById2 } = await import('./db');
          const customer2 = project?.customerId ? await getCustomerById(project.customerId) : null;
          const supplier2 = !customer2 && (project as any)?.supplierId ? await getSupplierById2((project as any).supplierId) : null;
          const entityName2 = customer2 ? (customer2.company || customer2.name) : (supplier2 ? (supplier2.company || supplier2.name) : null);
          if (entityName2 && project) {
            const { uploadFileToDrive } = await import('./googleDrive');
            const projectName = project.projectNumber
              ? `${project.projectNumber} ${project.title}`.substring(0, 100)
              : project.title.substring(0, 100);
            const driveResult = await uploadFileToDrive({
              filename: input.filename,
              mimeType: input.mimeType,
              buffer,
              customerName: entityName2,
              projectName,
            });
              // Drive-Status in DB speichern
              const db2 = await (await import('./db')).getDb();
              if (db2) {
                const { projectDocuments: pdTable } = await import('../drizzle/schema');
                const { eq: eq2, desc: desc2 } = await import('drizzle-orm');
                const [lastDoc] = await db2.select({ id: pdTable.id })
                  .from(pdTable)
                  .where(eq2(pdTable.projectId, input.projectId))
                  .orderBy(desc2(pdTable.createdAt))
                  .limit(1);
                if (lastDoc) {
                  await db2.update(pdTable)
                    .set({ driveFileId: driveResult.fileId, driveSynced: 1 })
                    .where(eq2(pdTable.id, lastDoc.id));
                }
              }
          } // end if entityName2
        } catch (e) {
          console.warn('[Drive Sync] Dokument-Upload Sync fehlgeschlagen:', e);
        }
        return { success: true, url, fileKey };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { projectDocuments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(projectDocuments).where(eq(projectDocuments.id, input.id));
        return { success: true };
      }),

    updateNote: protectedProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { projectDocuments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(projectDocuments)
          .set({ notes: input.notes || null })
          .where(eq(projectDocuments.id, input.id));
        return { success: true };
      }),

    updateCategory: protectedProcedure
      .input(z.object({
        id: z.number(),
        category: z.enum(['supplier_offer','nda','order','delivery_note','invoice','contract','drawing','cad_data','photo','protocol','rendering','other']),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { projectDocuments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(projectDocuments)
          .set({ category: input.category })
          .where(eq(projectDocuments.id, input.id));
        return { success: true };
      }),
    // KI-Extraktion: Positionen aus Lieferantenangebot-PDF lesen
    extractItems: protectedProcedure
      .input(z.object({
        docId: z.number(),       // ID des projectDocument (Lieferantenangebot)
      }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { projectDocuments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        // Dokument laden
        const [doc] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, input.docId)).limit(1);
        if (!doc) throw new Error('Dokument nicht gefunden');
        if (!doc.fileUrl) throw new Error('Keine Datei-URL vorhanden');
        // KI-Extraktion via LLM mit PDF file_url
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'Du bist ein Experte für das Lesen von Lieferantenangeboten. Extrahiere alle Positionen aus dem PDF und gib sie als JSON-Array zurück. Jede Position hat: position (Nummer), description (Beschreibung), quantity (Menge als Zahl), unit (Einheit z.B. Stk., m, kg), unitPriceNet (Einzelpreis netto als Zahl), taxRate (MwSt-Satz als Zahl, Standard 19). Falls kein Preis erkennbar, setze 0. Antworte NUR mit dem JSON-Array, kein anderer Text.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'file_url' as const,
                  file_url: {
                    url: doc.fileUrl,
                    mime_type: 'application/pdf' as const,
                  },
                },
                {
                  type: 'text' as const,
                  text: 'Extrahiere alle Positionen aus diesem Lieferantenangebot als JSON-Array. Format: [{"position":1,"description":"...","quantity":1,"unit":"Stk.","unitPriceNet":0,"taxRate":19}]',
                },
              ],
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'supplier_items',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        position: { type: 'integer' },
                        description: { type: 'string' },
                        quantity: { type: 'number' },
                        unit: { type: 'string' },
                        unitPriceNet: { type: 'number' },
                        taxRate: { type: 'number' },
                      },
                      required: ['position', 'description', 'quantity', 'unit', 'unitPriceNet', 'taxRate'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['items'],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response?.choices?.[0]?.message?.content ?? '{"items":[]}';
        let parsed: { items: any[] };
        try {
          parsed = typeof content === 'string' ? JSON.parse(content) : content;
        } catch {
          parsed = { items: [] };
        }
        return {
          docId: doc.id,
          filename: doc.filename,
          projectId: doc.projectId,
          items: (parsed.items ?? [])
            // Sortierung: kleinste Menge zuerst (aufsteigend), damit 1000 Stk. oben erscheint
            // wenn alle Mengen gleich sind, nach Position sortieren
            .sort((a: any, b: any) => {
              const qA = Number(a.quantity ?? 1);
              const qB = Number(b.quantity ?? 1);
              if (qA !== qB) return qA - qB; // kleinste Menge zuerst
              return (a.position ?? 0) - (b.position ?? 0);
            })
            .map((it: any, idx: number) => ({
              position: idx + 1, // Positionen neu nummerieren nach Sortierung
              description: String(it.description ?? ''),
              longDescription: '',
              isOptional: false,
              discount: '0',
              discountedNet: '0.00',
              quantity: String(it.quantity ?? 1),
              unit: String(it.unit ?? 'Stk.'),
              unitPriceNet: String(it.unitPriceNet ?? 0),
              taxRate: String(it.taxRate ?? 19),
              lineTotalNet: String((Number(it.quantity ?? 1) * Number(it.unitPriceNet ?? 0)).toFixed(2)),
              lineTax: String((Number(it.quantity ?? 1) * Number(it.unitPriceNet ?? 0) * Number(it.taxRate ?? 19) / 100).toFixed(2)),
              lineTotalGross: String((Number(it.quantity ?? 1) * Number(it.unitPriceNet ?? 0) * (1 + Number(it.taxRate ?? 19) / 100)).toFixed(2)),
            })),
        };
      }),

    bySupplier: protectedProcedure
      .input(z.object({ supplierId: z.number() }))
      .query(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) return [];
        const { projectDocuments, projects } = await import('../drizzle/schema');
        const { eq, desc } = await import('drizzle-orm');
        const rows = await db
          .select({
            id: projectDocuments.id,
            projectId: projectDocuments.projectId,
            projectTitle: projects.title,
            category: projectDocuments.category,
            filename: projectDocuments.filename,
            fileUrl: projectDocuments.fileUrl,
            fileKey: projectDocuments.fileKey,
            fileSize: projectDocuments.fileSize,
            mimeType: projectDocuments.mimeType,
            notes: projectDocuments.notes,
            uploadedBy: projectDocuments.uploadedBy,
            createdAt: projectDocuments.createdAt,
          })
          .from(projectDocuments)
          .innerJoin(projects, eq(projectDocuments.projectId, projects.id))
          .where(eq(projectDocuments.supplierId, input.supplierId))
          .orderBy(desc(projectDocuments.createdAt));
        return rows;
      }),

    // Manueller Re-Sync eines einzelnen Dokuments zu Google Drive
    syncToDrive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { projectDocuments: pdTable } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const { getProjectById, getCustomerById } = await import('./db');

        // Dokument aus DB laden
        const [doc] = await db.select().from(pdTable).where(eq(pdTable.id, input.id)).limit(1);
        if (!doc) throw new Error('Dokument nicht gefunden');

        // Datei von S3 herunterladen
        const fetchRes = await fetch(doc.fileUrl);
        if (!fetchRes.ok) throw new Error('Datei konnte nicht von S3 geladen werden');
        const buffer = Buffer.from(await fetchRes.arrayBuffer());

        // Projekt und Kunde laden
        const project = await getProjectById(doc.projectId);
        if (!project?.customerId) throw new Error('Projekt oder Kunde nicht gefunden');
        const customer = await getCustomerById(project.customerId);
        if (!customer) throw new Error('Kunde nicht gefunden');

        const { uploadFileToDrive } = await import('./googleDrive');
        const projectName = project.projectNumber
          ? `${project.projectNumber} ${project.title}`.substring(0, 100)
          : project.title.substring(0, 100);

        const driveResult = await uploadFileToDrive({
          filename: doc.filename,
          mimeType: doc.mimeType || 'application/octet-stream',
          buffer,
          customerName: customer.company || customer.name,
          projectName,
        });

        // Drive-Status in DB speichern
        await db.update(pdTable)
          .set({ driveFileId: driveResult.fileId, driveSynced: 1 })
          .where(eq(pdTable.id, input.id));

        return { success: true, driveFileId: driveResult.fileId };
      }),
  }),

  // ── Artikeldatenbank ────────────────────────────────────────────────────────
  articles: router({
    list: publicProcedure
      .input(z.object({ search: z.string().optional(), category: z.string().optional(), activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) return [];
        const { articles } = await import('../drizzle/schema');
        const { like, eq, and, or } = await import('drizzle-orm');
        const conditions: any[] = [];
        if (input?.activeOnly !== false) conditions.push(eq(articles.isActive, 1));
        if (input?.category) conditions.push(eq(articles.category, input.category));
        if (input?.search) {
          const s = `%${input.search}%`;
          conditions.push(or(like(articles.name, s), like(articles.articleNumber, s), like(articles.description, s)));
        }
        const rows = await db.select().from(articles)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(articles.name);
        return rows;
      }),

    create: protectedProcedure
      .input(z.object({
        articleNumber: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        longDescription: z.string().optional(),
        unit: z.string().default('Stk.'),
        unitPriceNet: z.string().default('0.00'),
        taxRate: z.number().default(19),
        category: z.string().optional(),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB not available');
        const { articles } = await import('../drizzle/schema');
        const now = Date.now();
        const [result] = await db.insert(articles).values({
          articleNumber: input.articleNumber || null,
          name: input.name,
          description: input.description || null,
          longDescription: input.longDescription || null,
          unit: input.unit,
          unitPriceNet: input.unitPriceNet,
          taxRate: input.taxRate,
          category: input.category || null,
          isActive: input.isActive ? 1 : 0,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        articleNumber: z.string().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        longDescription: z.string().optional(),
        unit: z.string().optional(),
        unitPriceNet: z.string().optional(),
        taxRate: z.number().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB not available');
        const { articles } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const { id, ...fields } = input;
        const update: any = { updatedAt: Date.now() };
        if (fields.articleNumber !== undefined) update.articleNumber = fields.articleNumber || null;
        if (fields.name !== undefined) update.name = fields.name;
        if (fields.description !== undefined) update.description = fields.description || null;
        if (fields.longDescription !== undefined) update.longDescription = fields.longDescription || null;
        if (fields.unit !== undefined) update.unit = fields.unit;
        if (fields.unitPriceNet !== undefined) update.unitPriceNet = fields.unitPriceNet;
        if (fields.taxRate !== undefined) update.taxRate = fields.taxRate;
        if (fields.category !== undefined) update.category = fields.category || null;
        if (fields.isActive !== undefined) update.isActive = fields.isActive ? 1 : 0;
        await db.update(articles).set(update).where(eq(articles.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB not available');
        const { articles } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(articles).where(eq(articles.id, input.id));
        return { success: true };
      }),

    categories: publicProcedure.query(async () => {
      const db = await (await import('./db')).getDb();
      if (!db) return [];
      const { articles } = await import('../drizzle/schema');
      const { isNotNull, ne } = await import('drizzle-orm');
      const rows = await db.selectDistinct({ category: articles.category }).from(articles)
        .where(isNotNull(articles.category));
      return rows.map(r => r.category).filter(Boolean) as string[];
    }),
  }),

  // ─── Lieferantenanfragen ──────────────────────────────────────────────────
  inquiries: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        supplierId: z.number().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => listInquiries(input)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const inquiry = await getInquiryById(input.id);
        if (!inquiry) throw new Error("Anfrage nicht gefunden");
        const items = await getInquiryItems(input.id);
        return { ...inquiry, items };
      }),

    nextNumber: protectedProcedure
      .query(async () => getNextInquiryNumber()),

    create: protectedProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        supplierName: z.string().optional(),
        supplierContact: z.string().optional(),
        supplierEmail: z.string().optional(),
        projectId: z.number().optional(),
        subject: z.string().optional(),
        introText: z.string().optional(),
        outroText: z.string().optional(),
        desiredDeliveryDate: z.string().optional(),
        paymentTerms: z.string().optional(),
        deliveryTerms: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          description: z.string(),
          longDescription: z.string().optional(),
          quantity: z.string().default("1.000"),
          unit: z.string().default("Stk."),
          remark: z.string().optional(),
          articleId: z.number().optional(),
        })).default([]),
      }))
      .mutation(async ({ input }) => {
        const { items, ...data } = input;
        const inquiryNumber = await getNextInquiryNumber();
        const id = await createInquiry({ ...data, inquiryNumber, status: "draft" } as any);
        if (items.length > 0) {
          await replaceInquiryItems(id, items as any);
        }
        return { id, inquiryNumber };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        supplierId: z.number().optional(),
        supplierName: z.string().optional(),
        supplierContact: z.string().optional(),
        supplierEmail: z.string().optional(),
        projectId: z.number().optional(),
        subject: z.string().optional(),
        introText: z.string().optional(),
        outroText: z.string().optional(),
        desiredDeliveryDate: z.string().optional(),
        paymentTerms: z.string().optional(),
        deliveryTerms: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          description: z.string(),
          longDescription: z.string().optional(),
          quantity: z.string().default("1.000"),
          unit: z.string().default("Stk."),
          remark: z.string().optional(),
          articleId: z.number().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, items, ...data } = input;
        await updateInquiry(id, data as any);
        if (items !== undefined) {
          await replaceInquiryItems(id, items as any);
        }
        return { id };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "sent", "answered", "completed", "cancelled"]),
      }))
      .mutation(async ({ input }) => {
        const extra: Record<string, any> = {};
        if (input.status === "sent") extra.sentAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        if (input.status === "answered") extra.answeredAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        await updateInquiry(input.id, { status: input.status, ...extra } as any);
        return { id: input.id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteInquiry(input.id);
        return { success: true };
      }),

    generatePdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const inquiry = await getInquiryById(input.id);
        if (!inquiry) throw new Error("Anfrage nicht gefunden");
        const items = await getInquiryItems(input.id);
        const settings = await getCompanySettings();
        // Inquiry als Invoice-kompatibles Objekt für den PDF-Renderer aufbereiten
        const inquiryAsInvoice = {
          ...inquiry,
          invoiceNumber: inquiry.inquiryNumber,
          type: "inquiry" as const,
          items: items.map((item: any) => ({
            ...item,
            unitPriceNet: "0.00",
            taxRate: 0,
            discount: 0,
            isOptional: false,
          })),
        };
        const pdfBuffer = await renderInvoicePdf(inquiryAsInvoice as any, settings);
        const { storagePut } = await import('./storage');
        const key = `inquiries/ANF-${inquiry.id}-${Date.now()}.pdf`;
        const { url } = await storagePut(key, pdfBuffer, 'application/pdf');
        return { url };
      }),
  }),

  // ─── Kundenakte (Google Drive) ──────────────────────────────────────────────
  customerFiles: router({
    // Alle Dateien eines Kunden auflisten (aggregiert aus allen Quellen)
    list: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { cadFiles, projectDocuments, invoices, projects, consultationEntries } = await import('../drizzle/schema');
        const { eq, and, isNotNull, desc, inArray } = await import('drizzle-orm');

        // Alle Projekte des Kunden ermitteln
        const customerProjects = await db.select({ id: projects.id, title: projects.title, projectNumber: projects.projectNumber })
          .from(projects)
          .where(eq(projects.customerId, input.customerId));
        const projectIds = customerProjects.map(p => p.id);
        const projectMap = Object.fromEntries(customerProjects.map(p => [p.id, p]));

        if (projectIds.length === 0) return [];

        // CAD-Dateien
        const cad = await db.select().from(cadFiles)
          .where(inArray(cadFiles.projectId, projectIds))
          .orderBy(desc(cadFiles.createdAt));

        // Projekt-Dokumente
        const docs = await db.select().from(projectDocuments)
          .where(inArray(projectDocuments.projectId, projectIds))
          .orderBy(desc(projectDocuments.createdAt));

        // Rechnungen mit PDF
        const invs = await db.select().from(invoices)
          .where(and(eq(invoices.customerId, input.customerId), isNotNull(invoices.pdfUrl)))
          .orderBy(desc(invoices.createdAt));

        // Beratungsprotokolle
        const consultations = await db.select().from(consultationEntries)
          .where(inArray(consultationEntries.projectId, projectIds))
          .orderBy(desc(consultationEntries.createdAt));

        // Kategorie-Mapping für projectDocuments
        const docCategoryMap: Record<string, string> = {
          supplier_offer: 'supplier_quote',
          nda: 'nda',
          order: 'other',
          delivery_note: 'other',
          invoice: 'invoice',
          contract: 'contract',
          drawing: 'drawing',
          cad_data: 'cad_data',
          other: 'other',
        };

        type AkteFile = {
          id: string;
          source: 'cad' | 'doc' | 'invoice' | 'photo' | 'protocol';
          sourceId: number;
          projectId: number;
          projectTitle: string;
          projectNumber: string | null;
          category: string;
          filename: string;
          fileUrl: string;
          fileSize: number | null;
          mimeType: string | null;
          notes: string | null;
          createdAt: string | number;
        };

        const result: AkteFile[] = [
          ...cad.map(f => ({
            id: `cad-${f.id}`,
            source: 'cad' as const,
            sourceId: f.id,
            projectId: f.projectId,
            projectTitle: projectMap[f.projectId]?.title ?? '',
            projectNumber: projectMap[f.projectId]?.projectNumber ?? null,
            category: 'cad_data',
            filename: f.filename,
            fileUrl: f.fileUrl,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
            notes: f.versionNote ?? null,
            createdAt: f.createdAt,
          })),
          // Fotos: Projekt-Dokumente mit Bild-MIME-Type
          ...docs.filter(f => f.mimeType && f.mimeType.startsWith('image/')).map(f => ({
            id: `photo-${f.id}`,
            source: 'photo' as const,
            sourceId: f.id,
            projectId: f.projectId,
            projectTitle: projectMap[f.projectId]?.title ?? '',
            projectNumber: projectMap[f.projectId]?.projectNumber ?? null,
            category: 'photo',
            filename: f.filename,
            fileUrl: f.fileUrl,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
            notes: f.notes ?? null,
            createdAt: f.createdAt,
          })),
          // Nicht-Bild Dokumente
          ...docs.filter(f => !f.mimeType || !f.mimeType.startsWith('image/')).map(f => ({
            id: `doc-${f.id}`,
            source: 'doc' as const,
            sourceId: f.id,
            projectId: f.projectId,
            projectTitle: projectMap[f.projectId]?.title ?? '',
            projectNumber: projectMap[f.projectId]?.projectNumber ?? null,
            category: docCategoryMap[f.category] ?? 'other',
            filename: f.filename,
            fileUrl: f.fileUrl,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
            notes: f.notes ?? null,
            createdAt: f.createdAt,
          })),
          // Beratungsprotokolle
          ...consultations.map(f => ({
            id: `protocol-${f.id}`,
            source: 'protocol' as const,
            sourceId: f.id,
            projectId: f.projectId ?? 0,
            projectTitle: f.projectId ? (projectMap[f.projectId]?.title ?? '') : '',
            projectNumber: f.projectId ? (projectMap[f.projectId]?.projectNumber ?? null) : null,
            category: 'protocol',
            filename: f.title,
            fileUrl: '',
            fileSize: null,
            mimeType: 'text/plain',
            notes: f.content ? (f.content.substring(0, 200) + (f.content.length > 200 ? '...' : '')) : null,
            createdAt: f.createdAt,
          })),
          ...invs.filter(f => f.pdfUrl).map(f => ({
            id: `inv-${f.id}`,
            source: 'invoice' as const,
            sourceId: f.id,
            projectId: f.projectId ?? 0,
            projectTitle: f.projectId ? (projectMap[f.projectId]?.title ?? '') : '',
            projectNumber: f.projectId ? (projectMap[f.projectId]?.projectNumber ?? null) : null,
            category: 'invoice',
            filename: `Rechnung-${f.invoiceNumber ?? f.id}.pdf`,
            fileUrl: f.pdfUrl!,
            fileSize: null,
            mimeType: 'application/pdf',
            notes: null,
            createdAt: f.createdAt ?? 0,
          })),
        ];

        // Sortierung: neueste zuerst
        result.sort((a, b) => {
          const ta = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
          const tb = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
          return tb - ta;
        });

        return result;
      }),

    // Datei hochladen (Base64-encoded)
    upload: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        customerName: z.string(),
        projectId: z.number().optional(),
        category: z.enum(['cad_data','drawing','photo','nda','protocol','supplier_quote','contract','invoice','other']).default('other'),
        filename: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(), // Base64-encoded Dateiinhalt
        fileSize: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { uploadFileToDrive } = await import('./googleDrive');
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { customerFiles } = await import('../drizzle/schema');

        // Base64 → Buffer
        const buffer = Buffer.from(input.fileBase64, 'base64');

        // Projektname für Unterordner ermitteln (wenn projectId angegeben)
        let projectName: string | undefined;
        if (input.projectId) {
          const { getProjectById } = await import('./db');
          const project = await getProjectById(input.projectId);
          if (project) {
            projectName = project.projectNumber
              ? `${project.projectNumber} ${project.title}`.substring(0, 100)
              : project.title.substring(0, 100);
          }
        }

        // In Google Drive hochladen
        const { fileId, fileUrl } = await uploadFileToDrive({
          filename: input.filename,
          mimeType: input.mimeType,
          buffer,
          customerName: input.customerName,
          projectName,
        });

        // Metadaten in DB speichern
        await db.insert(customerFiles).values({
          customerId: input.customerId,
          projectId: input.projectId || null,
          category: input.category,
          filename: input.filename,
          driveFileId: fileId,
          driveFileUrl: fileUrl,
          fileSize: input.fileSize || buffer.length,
          mimeType: input.mimeType,
          notes: input.notes || null,
          uploadedBy: ctx.user?.name || 'System',
          createdAt: Date.now(),
        });

        return { success: true, fileId, fileUrl };
      }),

    // Datei löschen
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteFileFromDrive } = await import('./googleDrive');
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { customerFiles } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');

        // Datei in DB finden
        const [file] = await db.select().from(customerFiles).where(eq(customerFiles.id, input.id)).limit(1);
        if (!file) throw new Error('Datei nicht gefunden');

        // Aus Google Drive löschen
        try {
          await deleteFileFromDrive(file.driveFileId);
        } catch (err) {
          console.warn('Google Drive Löschfehler (ignoriert):', err);
        }

        // Aus DB löschen
        await db.delete(customerFiles).where(eq(customerFiles.id, input.id));
        return { success: true };
      }),

    // Notiz aktualisieren
    updateNote: protectedProcedure
      .input(z.object({ id: z.number(), notes: z.string() }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { customerFiles } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(customerFiles).set({ notes: input.notes }).where(eq(customerFiles.id, input.id));
        return { success: true };
      }),

    // Dateien nach Kunde + Projekt filtern
    listByProject: protectedProcedure
      .input(z.object({ customerId: z.number(), projectId: z.number() }))
      .query(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { customerFiles } = await import('../drizzle/schema');
        const { eq, and, desc } = await import('drizzle-orm');
        return db.select().from(customerFiles)
          .where(and(
            eq(customerFiles.customerId, input.customerId),
            eq(customerFiles.projectId, input.projectId)
          ))
          .orderBy(desc(customerFiles.createdAt));
      }),

    // ZIP-Export aller Dateien einer Kundenakte
    zipExport: protectedProcedure
      .input(z.object({ customerId: z.number(), projectId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { customerFiles } = await import('../drizzle/schema');
        const { eq, and, desc } = await import('drizzle-orm');

        // Dateien aus DB laden
        let files;
        if (input.projectId) {
          files = await db.select().from(customerFiles)
            .where(and(eq(customerFiles.customerId, input.customerId), eq(customerFiles.projectId, input.projectId)))
            .orderBy(desc(customerFiles.createdAt));
        } else {
          files = await db.select().from(customerFiles)
            .where(eq(customerFiles.customerId, input.customerId))
            .orderBy(desc(customerFiles.createdAt));
        }

        if (files.length === 0) throw new Error('Keine Dateien vorhanden');

        // Dateien von Google Drive herunterladen und ZIP erstellen
        const archiver = (await import('archiver')).default;
        const { PassThrough } = await import('stream');
        const https = await import('https');
        const http = await import('http');

        const chunks: Buffer[] = [];
        const passThrough = new PassThrough();
        passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.pipe(passThrough);

        // Jede Datei von Drive herunterladen und zum Archiv hinzufügen
        for (const file of files) {
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.driveFileId}`;
          const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
            const protocol = downloadUrl.startsWith('https') ? https : http;
            const req = (protocol as any).get(downloadUrl, (res: any) => {
              // Handle redirects
              if (res.statusCode === 302 || res.statusCode === 301) {
                const redirectUrl = res.headers.location;
                const redirectProto = redirectUrl.startsWith('https') ? https : http;
                (redirectProto as any).get(redirectUrl, (res2: any) => {
                  const chunks2: Buffer[] = [];
                  res2.on('data', (c: Buffer) => chunks2.push(c));
                  res2.on('end', () => resolve(Buffer.concat(chunks2)));
                  res2.on('error', reject);
                }).on('error', reject);
              } else {
                const chunks2: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks2.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks2)));
                res.on('error', reject);
              }
            });
            req.on('error', reject);
          });

          // Kategorie-Ordner im ZIP
          const categoryFolder = file.category || 'sonstiges';
          archive.append(fileBuffer, { name: `${categoryFolder}/${file.filename}` });
        }

        await archive.finalize();
        await new Promise<void>(resolve => passThrough.on('end', resolve));

        const zipBuffer = Buffer.concat(chunks);
        const { storagePut } = await import('./storage');
        const zipKey = `customer-akte-exports/${input.customerId}-${Date.now()}.zip`;
        const { url } = await storagePut(zipKey, zipBuffer, 'application/zip');

        return { url, fileCount: files.length };
      }),

    // Google Drive Verbindung testen
    testConnection: protectedProcedure
      .query(async () => {
        const { testDriveConnection } = await import('./googleDrive');
        return testDriveConnection();
      }),

    // Migrations-Endpunkt: Synchronisiert ALLE Dateien aus der DB auf Google Drive
    // Strategie 1: Datei hat Drive-ID → in richtigen Projektordner verschieben
    // Strategie 2: Datei hat KEINE Drive-ID → von S3 herunterladen und neu auf Drive hochladen
    migrateToProjectFolders: protectedProcedure
      .mutation(async () => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('DB nicht verfügbar');
        const { cadFiles: cadFilesTable, projectDocuments: pdTable } = await import('../drizzle/schema');
        const { getOrCreateProjectFolder, moveFileToDriveFolder, uploadFileToDrive } = await import('./googleDrive');
        const { getProjectById, getCustomerById, getSupplierById } = await import('./db');
        const { storageGet } = await import('./storage');
        const { eq: eqOp } = await import('drizzle-orm');

        let syncedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const movedFiles: string[] = [];

        // Hilfsfunktion: Entitätsname aus Projekt ermitteln (Kunde oder Lieferant)
        async function getEntityName(project: any): Promise<string | null> {
          if (project.customerId) {
            const customer = await getCustomerById(project.customerId);
            return customer ? (customer.company || customer.name) : null;
          } else if ((project as any).supplierId) {
            const supplier = await getSupplierById((project as any).supplierId);
            return supplier ? (supplier.company || supplier.name) : null;
          }
          return null;
        }

        function buildProjectName(project: any): string {
          return project.projectNumber
            ? `${project.projectNumber} ${project.title}`.substring(0, 100)
            : project.title.substring(0, 100);
        }

        // Hilfsfunktion: Datei von S3 als Buffer herunterladen
        async function fetchBufferFromS3(fileKey: string): Promise<Buffer> {
          const { url } = await storageGet(fileKey);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`S3-Download fehlgeschlagen (${response.status}): ${fileKey}`);
          return Buffer.from(await response.arrayBuffer());
        }

        // ── Schritt 1: CAD-Dateien synchronisieren ──────────────────────────────
        const allCadFiles = await db.select().from(cadFilesTable);
        for (const file of allCadFiles) {
          try {
            const project = await getProjectById(file.projectId);
            if (!project) continue;
            const entityName = await getEntityName(project);
            if (!entityName) continue; // Kein Kunde/Lieferant zugewiesen → überspringen
            const projectName = buildProjectName(project);

            if (file.driveFileId) {
              // Strategie 1: Hat Drive-ID → in richtigen Projektordner verschieben
              const targetFolderId = await getOrCreateProjectFolder(entityName, projectName);
              const moved = await moveFileToDriveFolder(file.driveFileId, targetFolderId);
              if (moved) {
                syncedCount++;
                movedFiles.push(`CAD: ${file.filename} → ${entityName}/${projectName}`);
              } else {
                movedFiles.push(`CAD (bereits ok): ${file.filename}`);
              }
            } else {
              // Strategie 2: Keine Drive-ID → von S3 herunterladen und auf Drive hochladen
              const buffer = await fetchBufferFromS3(file.fileKey);
              const result = await uploadFileToDrive({
                filename: file.filename,
                mimeType: file.mimeType || 'application/octet-stream',
                buffer,
                customerName: entityName,
                projectName,
              });
              await db.update(cadFilesTable)
                .set({ driveFileId: result.fileId, driveSynced: 1 })
                .where(eqOp(cadFilesTable.id, file.id));
              syncedCount++;
              movedFiles.push(`CAD (neu hochgeladen): ${file.filename} → ${entityName}/${projectName}`);
            }
          } catch (e: any) {
            errorCount++;
            errors.push(`CAD ${file.id} (${file.filename}): ${e.message}`);
          }
        }

        // ── Schritt 2: Projekt-Dokumente synchronisieren ─────────────────────────
        const allDocs = await db.select().from(pdTable);
        for (const doc of allDocs) {
          try {
            const project = await getProjectById(doc.projectId);
            if (!project) continue;
            const entityName = await getEntityName(project);
            if (!entityName) continue; // Kein Kunde/Lieferant zugewiesen → überspringen
            const projectName = buildProjectName(project);

            if (doc.driveFileId) {
              // Strategie 1: Hat Drive-ID → in richtigen Projektordner verschieben
              const targetFolderId = await getOrCreateProjectFolder(entityName, projectName);
              const moved = await moveFileToDriveFolder(doc.driveFileId, targetFolderId);
              if (moved) {
                syncedCount++;
                movedFiles.push(`Dok: ${doc.filename} → ${entityName}/${projectName}`);
              } else {
                movedFiles.push(`Dok (bereits ok): ${doc.filename}`);
              }
            } else {
              // Strategie 2: Keine Drive-ID → von S3 herunterladen und auf Drive hochladen
              const buffer = await fetchBufferFromS3(doc.fileKey);
              const result = await uploadFileToDrive({
                filename: doc.filename,
                mimeType: doc.mimeType || 'application/octet-stream',
                buffer,
                customerName: entityName,
                projectName,
              });
              await db.update(pdTable)
                .set({ driveFileId: result.fileId, driveSynced: 1 })
                .where(eqOp(pdTable.id, doc.id));
              syncedCount++;
              movedFiles.push(`Dok (neu hochgeladen): ${doc.filename} → ${entityName}/${projectName}`);
            }
          } catch (e: any) {
            errorCount++;
            errors.push(`Dok ${doc.id} (${doc.filename}): ${e.message}`);
          }
        }

        return { success: true, movedCount: syncedCount, errorCount, errors, movedFiles };
      }),
  }),

  // ─── Statistics ─────────────────────────────────────────────────────────────
  statistics: router({
    projectStats: protectedProcedure.input(z.object({
      year: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const db = await (await import('./db')).getDb();
      if (!db) return { byMonth: [], rejectionReasons: [], kpis: { hitRate: 0, totalOffers: 0, totalOrders: 0 } };
      const { projects: projectsTable } = await import('../drizzle/schema');
      const year = input?.year ?? new Date().getFullYear();
      // Alle Projekte des Jahres laden (nach createdAt)
      const allProjects = await db.select({
        id: projectsTable.id,
        status: projectsTable.status,
        rejectionReason: projectsTable.rejectionReason,
        createdAt: projectsTable.createdAt,
        archivedAt: projectsTable.archivedAt,
      }).from(projectsTable);
      // Projekte des gewählten Jahres (nach createdAt)
      const yearProjects = allProjects.filter((p: any) => p.createdAt && new Date(p.createdAt).getFullYear() === year);
      // Aufträge = order, production, shipping, completed
      const orderStatuses = ['order','production','shipping','completed'];
      const offerStatuses = ['offer','calculation','inquiry','order','production','shipping','completed','cancelled','rejected'];
      // Monatsverlauf
      const byMonth = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthProjects = yearProjects.filter((p: any) => p.createdAt && new Date(p.createdAt).getMonth() + 1 === month);
        const orders = monthProjects.filter((p: any) => orderStatuses.includes(p.status)).length;
        const rejected = monthProjects.filter((p: any) => p.status === 'rejected').length;
        const offers = monthProjects.length;
        return { month, offers, orders, rejected };
      });
      // Ablehnungsgründe des Jahres
      const rejectedYear = yearProjects.filter((p: any) => p.status === 'rejected');
      const reasonMap: Record<string, number> = {};
      for (const p of rejectedYear) {
        const r = (p.rejectionReason as string) ?? 'sonstiges';
        reasonMap[r] = (reasonMap[r] ?? 0) + 1;
      }
      const rejectionReasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count }));
      // KPIs
      const totalOffers = yearProjects.length;
      const totalOrders = yearProjects.filter((p: any) => orderStatuses.includes(p.status)).length;
      const hitRate = totalOffers > 0 ? Math.round((totalOrders / totalOffers) * 100) : 0;
      return { byMonth, rejectionReasons, kpis: { hitRate, totalOffers, totalOrders } };
    }),
  }),
});
export type AppRouter = typeof appRouter;