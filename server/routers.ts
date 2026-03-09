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
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      sevdeskId: z.string().optional(),
    })).mutation(async ({ input }) => { await createCustomer(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      type: z.enum(["b2b", "museum", "industry", "private", "other"]).optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateCustomer(id, data); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteCustomer(input.id); return { success: true }; }),
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
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateLeadSource(id, data); return { success: true }; }),
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
    })).mutation(async ({ input }) => { await createProject(input); return { success: true }; }),
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
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateProject(id, data); return { success: true }; }),
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
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateProjectItem(id, data); return { success: true }; }),
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
      phone: z.string().optional(),
      address: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      rating: z.number().min(1).max(5).default(3),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { await createSupplier(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      rating: z.number().min(1).max(5).optional(),
      isActive: z.boolean().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateSupplier(id, data); return { success: true }; }),
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
    })).mutation(async ({ input }) => { await createRfq(input); return { success: true }; }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["draft", "sent", "responses_received", "completed"]),
    })).mutation(async ({ input }) => { await updateRfq(input.id, { status: input.status }); return { success: true }; }),
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
    })).mutation(async ({ input }) => { await createShipment(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      carrier: z.string().optional(),
      trackingNumber: z.string().optional(),
      shippedAt: z.date().optional(),
      estimatedDelivery: z.date().optional(),
      deliveredAt: z.date().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateShipment(id, data); return { success: true }; }),
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
    })).mutation(async ({ input }) => { const { id, ...data } = input; await updateKnowledgeEntry(id, data); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteKnowledgeEntry(input.id); return { success: true }; }),
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
    })).mutation(async ({ input }) => {
      // Fetch relevant knowledge entries
      const knowledge = await getKnowledgeEntries(input.prompt.split(" ").slice(0, 3).join(" "));
      const knowledgeContext = knowledge.slice(0, 5).map(k => `[${k.title}]: ${k.content}`).join("\n\n");

      const systemPrompt = `Du bist ein technischer Berater für Daniel Rincón von Fabrica GmbH, spezialisiert auf 3D-Druck, CNC-Bearbeitung, Oberflächenbehandlung, Modellbau und CAD-Dienstleistungen. 
Du antwortest professionell auf Deutsch und nutzt das folgende Fachwissen als Grundlage:

${knowledgeContext || "Kein spezifisches Wissen verfügbar — nutze allgemeines Fachwissen."}

Erstelle eine professionelle Beratungsantwort oder E-Mail basierend auf der Anfrage. Der Text soll direkt verwendbar sein.`;

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
      const session = await createAiSession({
        projectId: input.projectId,
        customerId: input.customerId,
        prompt: input.prompt,
        generatedText: finalText,
        usedKnowledgeIds: knowledge.slice(0, 5).map(k => k.id),
      });

      return { text: finalText, usedKnowledge: knowledge.slice(0, 5) };
    }),
     markSent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await updateAiSession(input.id, { sentAsEmail: true, sentAt: new Date() });
      return { success: true };
    }),
  }),

  // ─── Quick Notes ────────────────────────────────────────────────────────────
  quickNotes: router({
    list: protectedProcedure.query(async () => getQuickNotes(100)),
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
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => getNotes(input?.status)),

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

  // ─── Data Export ─────────────────────────────────────────────────────────────
  export: router({
    full: protectedProcedure.query(async () => getFullExport()),
  }),
});
export type AppRouter = typeof appRouter;
