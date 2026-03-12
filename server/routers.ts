import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
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
  getQuickNotes, createQuickNote, deleteQuickNote,
  getFullExport,
  getNotes, getNoteById, createNote, updateNote, deleteNote,
  getNoteAttachments, addNoteAttachment, deleteNoteAttachment,
  getNoteReminders, addNoteReminder, deleteNoteReminder,
  getPendingReminders, markReminderSent,
  getComplaintsByProject, getAllComplaints, createComplaint, updateComplaint, deleteComplaint,
  addComplaintAttachment, deleteComplaintAttachment,
  getInvoices, getInvoiceById, createInvoice, updateInvoice, changeInvoiceStatus,
  lockInvoice, cancelInvoice, deleteInvoiceDraft, getInvoiceAuditLog, getNextInvoiceNumber,
  getCompanySettings, upsertCompanySettings,
  listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvent,
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
      leadSourceId: z.number().optional(),
      driveFolderUrl: z.string().optional(),
      notes: z.string().optional(),
      internalNotes: z.string().optional(),
      deadline: z.date().optional(),
    })).mutation(async ({ input }) => { await createProject(input as any); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      projectNumber: z.string().optional(),
      type: z.enum(["serial_part", "spare_part", "museum", "consulting", "cad_work", "other"]).optional(),
      status: z.enum(["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"]).optional(),
      customerId: z.number().nullable().optional(),
      leadSourceId: z.number().nullable().optional(),
      driveFolderUrl: z.string().optional(),
      notes: z.string().optional(),
      internalNotes: z.string().optional(),
      deadline: z.date().nullable().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateProject(id, data as any); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteProject(input.id); return { success: true }; }),
    changeStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"]),
    })).mutation(async ({ input }) => { await updateProject(input.id, { status: input.status }); return { success: true }; }),
  }),

  // ─── Project Items ───────────────────────────────────────────────────────────
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
      return { success: true, url };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteCadFile(input.id); return { success: true }; }),
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
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteQuickNote(input.id);
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
        remindAt: z.string(), // ISO string
      }))
      .mutation(async ({ input }) => {
        await addNoteReminder({
          noteId: input.noteId,
          label: input.label,
          remindAt: new Date(input.remindAt),
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
    nextNumber: protectedProcedure.input(z.object({ type: z.enum(['invoice','offer','credit_note']) })).query(async ({ input }) => {
      // Nur Vorschau, keine Reservierung
      return { preview: true };
    }),
    create: protectedProcedure.input(z.object({
      type: z.enum(['offer','invoice','credit_note']).default('offer'),
      customerId: z.number().optional(),
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
      })).default([]),
    })).mutation(async ({ input, ctx }) => {
      const { items, ...invoiceData } = input;
      const invoiceNumber = await getNextInvoiceNumber(input.type);
      const id = await createInvoice(
        { ...invoiceData as any, invoiceNumber },
        items as any,
        ctx.user.email ?? 'system',
      );
      return { id, invoiceNumber };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      customerId: z.number().optional(),
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
      })).optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, items, ...data } = input;
      await updateInvoice(id, data as any, items as any ?? null, ctx.user.email ?? 'system');
      return { success: true };
    }),
    changeStatus: protectedProcedure.input(z.object({ id: z.number(), status: z.string() })).mutation(async ({ input, ctx }) => {
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
    convertToInvoice: protectedProcedure
      .input(z.object({ offerId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Angebot laden
        const offer = await getInvoiceById(input.offerId);
        if (!offer) throw new Error('Angebot nicht gefunden');
        if (offer.type !== 'offer') throw new Error('Nur Angebote können in Rechnungen umgewandelt werden');
        // Neue Rechnungsnummer vergeben
        const invoiceNumber = await getNextInvoiceNumber('invoice');
        const today = new Date().toISOString().slice(0, 10);
        // Fälligkeitsdatum: heute + 14 Tage
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Neue Rechnung aus Angebotsdaten erstellen
        const invoiceData: any = {
          invoiceNumber,
          type: 'invoice' as const,
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
          dueDate,
          deliveryDate: offer.deliveryDate,
          paymentTerms: offer.paymentTerms,
          taxMode: offer.taxMode,
          subtotalNet: offer.subtotalNet,
          taxAmount: offer.taxAmount,
          totalGross: offer.totalGross,
          currency: offer.currency,
          introText: offer.introText,
          notes: offer.notes,
          footerText: offer.footerText,
        };
        const items = (offer.items ?? []).map((item: any) => ({
          invoiceId: 0, // wird in createInvoice überschrieben
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceNet: item.unitPriceNet,
          taxRate: item.taxRate,
          lineTotalNet: item.lineTotalNet,
          lineTax: item.lineTax,
          lineTotalGross: item.lineTotalGross,
        }));
        const newId = await createInvoice(invoiceData, items, ctx.user.email ?? 'system');
        // Angebot auf 'invoiced' setzen
        await changeInvoiceStatus(input.offerId, 'invoiced', ctx.user.email ?? 'system');
        return { id: newId, invoiceNumber };
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
        kleinunternehmer: z.boolean().optional(),
        // Nummernkreis
        offerPrefix: z.string().max(20).optional(),
        invoicePrefix: z.string().max(20).optional(),
        creditNotePrefix: z.string().max(20).optional(),
        numberSeparator: z.string().max(5).optional(),
        numberPadding: z.number().int().min(1).max(8).optional(),
        includeYear: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return upsertCompanySettings({
          ...input,
          kleinunternehmer: input.kleinunternehmer !== undefined ? (input.kleinunternehmer ? 1 : 0) : undefined,
          includeYear: input.includeYear !== undefined ? (input.includeYear ? 1 : 0) : undefined,
        } as any);
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
        const now = new Date();
        const timeMin = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();
        const timeMax = new Date(now.getTime() + 60 * 24 * 3600000).toISOString();
        // MCP Google Calendar abfragen
        let googleEvents: any[] = [];
        try {
          const result = execSync(
            `manus-mcp-cli tool call google_calendar_search_events --server google-calendar --input '${JSON.stringify({ calendar_id: 'primary', time_min: timeMin, time_max: timeMax, max_results: 100 })}'`,
            { encoding: 'utf8', timeout: 30000 }
          );
          // Parse MCP result
          const lines = result.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              try { googleEvents = JSON.parse(trimmed); break; } catch {}
            }
          }
          // Try to find JSON array in output
          const jsonMatch = result.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch && googleEvents.length === 0) {
            try { googleEvents = JSON.parse(jsonMatch[0]); } catch {}
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
        category: z.enum(['supplier_offer','nda','order','delivery_note','invoice','contract','drawing','other']).default('other'),
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
  }),
});
export type AppRouter = typeof appRouter;