/**
 * chatRouter.ts — Kunden-Chat-Modul (isoliert, additiv)
 * Prozeduren: getMessages, sendMessage, portalAuth, getPortalConfig,
 *             setupPortal, sendInvitation, portalSendMessage, portalGetMessages
 */
import { z } from "zod";
import * as bcrypt from "bcryptjs";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  projectChatMessages,
  projectPortalConfig,
  projects,
  customers,
} from "../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";
import { storagePut } from "./storage";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── @Mention-Erkennung ───────────────────────────────────────────────────────
function detectMention(content: string, contactName: string | null | undefined): boolean {
  if (!contactName) return false;
  // Erkennt @Frau Gruner, @Max Mustermann etc.
  const escaped = contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`@${escaped}`, "i").test(content);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const chatRouter = router({

  // ERP: Nachrichten eines Projekts abrufen
  getMessages: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const msgs = await db
        .select()
        .from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));
      return msgs;
    }),

  // ERP: Nachricht senden (interner Nutzer)
  sendMessage: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      content: z.string().min(1).max(4000),
      fileBase64: z.string().optional(),
      filename: z.string().optional(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Projekt + Kunde laden für @Mention-Prüfung
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projekt nicht gefunden" });

      // Anhang hochladen wenn vorhanden
      let attachmentUrl: string | undefined;
      let attachmentKey: string | undefined;
      if (input.fileBase64 && input.filename) {
        const buf = Buffer.from(input.fileBase64, "base64");
        const key = `chat/${input.projectId}/${randomSuffix()}-${input.filename}`;
        const { url } = await storagePut(key, buf, input.mimeType ?? "application/octet-stream");
        attachmentUrl = url;
        attachmentKey = key;
      }

      // @Mention prüfen
      let mentionTriggered = 0;
      let customerEmail: string | null = null;
      let customerContactName: string | null = null;

      if (project.customerId) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, project.customerId))
          .limit(1);
        if (customer) {
          customerEmail = customer.email ?? null;
          customerContactName = customer.name ?? null;
        }
      }

      if (detectMention(input.content, customerContactName) && customerEmail) {
        mentionTriggered = 1;
        // E-Mail-Versand asynchron (nicht blockierend)
        // Resend-Helper wird in Phase 4 implementiert
        try {
          const { sendMentionNotification } = await import("./resend");
          const [portalCfg] = await db
            .select()
            .from(projectPortalConfig)
            .where(and(
              eq(projectPortalConfig.projectId, input.projectId),
              eq(projectPortalConfig.isActive, 1)
            ))
            .limit(1);
          if (portalCfg) {
            await sendMentionNotification({
              to: customerEmail,
              projectTitle: project.title,
              projectId: input.projectId,
            });
          }
        } catch (_e) {
          // E-Mail-Fehler soll Nachricht nicht blockieren
        }
      }

      const now = Date.now();
      await db.insert(projectChatMessages).values({
        projectId: input.projectId,
        senderType: "erp",
        senderName: ctx.user.name ?? "ERP-Nutzer",
        content: input.content,
        attachmentUrl: attachmentUrl ?? null,
        attachmentKey: attachmentKey ?? null,
        attachmentName: input.filename ?? null,
        attachmentMime: input.mimeType ?? null,
        attachmentSize: input.fileSize ?? null,
        mentionTriggered,
        createdAt: now,
      });

      return { success: true };
    }),

  // ERP: Portal einrichten / Passwort setzen
  setupPortal: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(6).max(64),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const hash = await bcrypt.hash(input.password, 12);
      const now = Date.now();

      const [existing] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);

      if (existing) {
        await db
          .update(projectPortalConfig)
          .set({ passwordHash: hash, isActive: 1, updatedAt: now })
          .where(eq(projectPortalConfig.projectId, input.projectId));
      } else {
        await db.insert(projectPortalConfig).values({
          projectId: input.projectId,
          passwordHash: hash,
          isActive: 1,
          driveBackupDone: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      return { success: true };
    }),

  // ERP: Portal-Konfiguration abrufen
  getPortalConfig: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      return cfg ?? null;
    }),

  // ERP: Einladungs-E-Mail senden
  sendInvitation: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projekt nicht gefunden" });

      const [portalCfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!portalCfg) throw new TRPCError({ code: "BAD_REQUEST", message: "Portal noch nicht eingerichtet. Bitte zuerst ein Passwort setzen." });
      if (!portalCfg.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Portal ist deaktiviert (Projekt abgeschlossen)." });

      let customerEmail: string | null = null;
      let customerName: string | null = null;
      if (project.customerId) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, project.customerId))
          .limit(1);
        if (customer) {
          customerEmail = customer.email ?? null;
          customerName = customer.name ?? null;
        }
      }
      if (!customerEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Keine E-Mail-Adresse beim Kunden hinterlegt." });

      const portalUrl = `${input.origin}/projekt-portal/${input.projectId}`;

      const { sendInvitationEmail } = await import("./resend");
      const result = await sendInvitationEmail({
        to: customerEmail,
        customerName: customerName ?? undefined,
        projectTitle: project.title,
        portalUrl,
        projectId: input.projectId,
      });

      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "E-Mail-Versand fehlgeschlagen" });

      await db
        .update(projectPortalConfig)
        .set({ invitationSentAt: Date.now(), updatedAt: Date.now() })
        .where(eq(projectPortalConfig.projectId, input.projectId));

      return { success: true };
    }),

  // PORTAL (öffentlich): Authentifizierung mit Passwort
  portalAuth: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);

      if (!cfg) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal nicht gefunden" });
      if (!cfg.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "PORTAL_CLOSED" });

      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Falsches Passwort" });

      // Projekt-Titel zurückgeben
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      return {
        success: true,
        projectTitle: project?.title ?? `Projekt #${input.projectId}`,
        projectId: input.projectId,
      };
    }),

  // PORTAL (öffentlich): Nachrichten abrufen (nach erfolgreicher Auth im Client)
  portalGetMessages: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal nicht gefunden" });

      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Nicht autorisiert" });

      const msgs = await db
        .select()
        .from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId))
        .orderBy(asc(projectChatMessages.createdAt));
      return msgs;
    }),

  // PORTAL (öffentlich): Nachricht vom Kunden senden
  portalSendMessage: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(1),
      content: z.string().min(1).max(4000),
      senderName: z.string().min(1).max(255),
      fileBase64: z.string().optional(),
      filename: z.string().optional(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal nicht gefunden" });
      if (!cfg.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "PORTAL_CLOSED" });

      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Nicht autorisiert" });

      // Anhang hochladen wenn vorhanden
      let attachmentUrl: string | undefined;
      let attachmentKey: string | undefined;
      if (input.fileBase64 && input.filename) {
        const buf = Buffer.from(input.fileBase64, "base64");
        const key = `chat/${input.projectId}/customer-${randomSuffix()}-${input.filename}`;
        const { url } = await storagePut(key, buf, input.mimeType ?? "application/octet-stream");
        attachmentUrl = url;
        attachmentKey = key;
      }

      await db.insert(projectChatMessages).values({
        projectId: input.projectId,
        senderType: "customer",
        senderName: input.senderName,
        content: input.content,
        attachmentUrl: attachmentUrl ?? null,
        attachmentKey: attachmentKey ?? null,
        attachmentName: input.filename ?? null,
        attachmentMime: input.mimeType ?? null,
        attachmentSize: input.fileSize ?? null,
        mentionTriggered: 0,
        createdAt: Date.now(),
      });

      return { success: true };
    }),

  // ─── Chat beenden / wieder öffnen (ERP-intern) ───────────────────────────────
  closeChat: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "NOT_FOUND", message: "Portal nicht konfiguriert" });
      await db
        .update(projectPortalConfig)
        .set({ chatClosed: 1, updatedAt: Date.now() })
        .where(eq(projectPortalConfig.projectId, input.projectId));
      return { success: true };
    }),

  reopenChat: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "NOT_FOUND", message: "Portal nicht konfiguriert" });
      await db
        .update(projectPortalConfig)
        .set({ chatClosed: 0, updatedAt: Date.now() })
        .where(eq(projectPortalConfig.projectId, input.projectId));
      return { success: true };
    }),

  // ─── Projektname live laden (für Portal-Header) ──────────────────────────────
  getProjectInfo: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "NOT_FOUND", message: "Portal nicht gefunden" });
      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Nicht autorisiert" });
      const [project] = await db
        .select({ id: projects.id, title: projects.title })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      return {
        title: project?.title ?? `Projekt #${input.projectId}`,
        chatClosed: cfg.chatClosed === 1,
      };
    }),
});
