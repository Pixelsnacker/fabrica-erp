/**
 * todoRouter.ts — Projekt-Todos (Chat-Modul Erweiterung)
 * Prozeduren: list, create, markDone, handover
 * Zugriff: ERP (protectedProcedure) + Kundenportal (publicProcedure mit Passwort)
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { projectTodos, projectPortalConfig, projects, customers } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

// ─── ERP-seitige Prozeduren (authentifiziert) ────────────────────────────────

export const todoRouter = router({
  // Liste aller Todos für ein Projekt (ERP)
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      return db
        .select()
        .from(projectTodos)
        .where(eq(projectTodos.projectId, input.projectId))
        .orderBy(projectTodos.createdAt);
    }),

  // Neues Todo anlegen (ERP)
  create: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      text: z.string().min(1).max(1000),
      assignedTo: z.string().optional(),
      assignedToType: z.enum(["erp", "customer"]).optional(),
      customerEmail: z.string().email().optional(), // für E-Mail-Benachrichtigung
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const createdBy = ctx.user.name ?? ctx.user.email ?? "ERP-Nutzer";

      const [result] = await db.insert(projectTodos).values({
        projectId: input.projectId,
        text: input.text,
        createdBy,
        createdByType: "erp",
        assignedTo: input.assignedTo ?? null,
        assignedToType: input.assignedToType ?? null,
        status: "open",
        createdAt: Date.now(),
      });

      // E-Mail an Kunden wenn Zuweisung an customer
      if (input.assignedToType === "customer" && input.customerEmail) {
        try {
          const [project] = await db
            .select({ title: projects.title })
            .from(projects)
            .where(eq(projects.id, input.projectId))
            .limit(1);
          const portalUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL ? "" : ""}`;
          // portalUrl wird vom Frontend übergeben, hier Fallback
          const { sendTodoAssignedEmail } = await import("./resend");
          await sendTodoAssignedEmail({
            to: input.customerEmail,
            projectTitle: project?.title ?? `Projekt #${input.projectId}`,
            portalUrl: input.assignedTo ?? "",
          });
        } catch (e) {
          console.warn("[todoRouter] E-Mail-Versand fehlgeschlagen:", e);
        }
      }

      return { id: (result as any).insertId };
    }),

  // Todo als erledigt markieren (ERP)
  markDone: protectedProcedure
    .input(z.object({ todoId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const doneBy = ctx.user.name ?? ctx.user.email ?? "ERP-Nutzer";
      await db
        .update(projectTodos)
        .set({ status: "done", doneAt: Date.now(), doneBy })
        .where(eq(projectTodos.id, input.todoId));
      return { success: true };
    }),

  // Todo übergeben (ERP)
  handover: protectedProcedure
    .input(z.object({
      todoId: z.number().int().positive(),
      assignedTo: z.string().min(1),
      assignedToType: z.enum(["erp", "customer"]),
      handoverComment: z.string().optional(),
      customerEmail: z.string().email().optional(),
      portalUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Todo laden um Projekt-ID zu ermitteln
      const [todo] = await db
        .select()
        .from(projectTodos)
        .where(eq(projectTodos.id, input.todoId))
        .limit(1);
      if (!todo) throw new TRPCError({ code: "NOT_FOUND", message: "Todo nicht gefunden" });

      await db
        .update(projectTodos)
        .set({
          assignedTo: input.assignedTo,
          assignedToType: input.assignedToType,
          handoverComment: input.handoverComment ?? null,
        })
        .where(eq(projectTodos.id, input.todoId));

      // E-Mail an Kunden bei Übergabe an customer
      if (input.assignedToType === "customer" && input.customerEmail && input.portalUrl) {
        try {
          const [project] = await db
            .select({ title: projects.title })
            .from(projects)
            .where(eq(projects.id, todo.projectId))
            .limit(1);
          const { sendTodoAssignedEmail } = await import("./resend");
          await sendTodoAssignedEmail({
            to: input.customerEmail,
            projectTitle: project?.title ?? `Projekt #${todo.projectId}`,
            portalUrl: input.portalUrl,
          });
        } catch (e) {
          console.warn("[todoRouter] E-Mail-Versand fehlgeschlagen:", e);
        }
      }

      return { success: true };
    }),

  // ─── Kundenportal-seitige Prozeduren (öffentlich, mit Passwort) ──────────────

  // Liste aller Todos für Kundenportal
  portalList: publicProcedure
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
      if (!cfg) throw new TRPCError({ code: "NOT_FOUND" });
      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED" });

      return db
        .select()
        .from(projectTodos)
        .where(eq(projectTodos.projectId, input.projectId))
        .orderBy(projectTodos.createdAt);
    }),

  // Kunde markiert Todo als erledigt (nur wenn assignedToType === "customer")
  portalMarkDone: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(1),
      todoId: z.number().int().positive(),
      senderName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "NOT_FOUND" });
      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Todos die dem Kunden zugewiesen sind ODER keine Zuweisung haben dürfen erledigt markiert werden
      const [todo] = await db
        .select()
        .from(projectTodos)
        .where(and(eq(projectTodos.id, input.todoId), eq(projectTodos.projectId, input.projectId)))
        .limit(1);
      if (!todo) throw new TRPCError({ code: "NOT_FOUND" });
      if (todo.assignedToType === "erp") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Diese Aufgabe ist dem Fabrica-Team zugewiesen und kann nicht vom Kunden erledigt werden." });
      }

      await db
        .update(projectTodos)
        .set({ status: "done", doneAt: Date.now(), doneBy: input.senderName })
        .where(eq(projectTodos.id, input.todoId));

      return { success: true };
    }),

  // Kunde erstellt Todo (vom Portal aus)
  portalCreate: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      password: z.string().min(1),
      text: z.string().min(1).max(1000),
      senderName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [cfg] = await db
        .select()
        .from(projectPortalConfig)
        .where(eq(projectPortalConfig.projectId, input.projectId))
        .limit(1);
      if (!cfg) throw new TRPCError({ code: "NOT_FOUND" });
      const valid = await bcrypt.compare(input.password, cfg.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED" });

      const [result] = await db.insert(projectTodos).values({
        projectId: input.projectId,
        text: input.text,
        createdBy: input.senderName,
        createdByType: "customer",
        assignedTo: null,
        assignedToType: null,
        status: "open",
        createdAt: Date.now(),
      });

      return { id: (result as any).insertId };
    }),

  // ERP: Todo-Text bearbeiten (nur ERP-Nutzer)
  updateTodo: protectedProcedure
    .input(z.object({
      todoId: z.number().int().positive(),
      text: z.string().min(1).max(1000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db
        .update(projectTodos)
        .set({ text: input.text.trim() })
        .where(eq(projectTodos.id, input.todoId));
      return { success: true };
    }),

  // ERP: Todo wieder öffnen (Toggle)
  reopen: protectedProcedure
    .input(z.object({ todoId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db
        .update(projectTodos)
        .set({ status: "open", doneAt: null, doneBy: null })
        .where(eq(projectTodos.id, input.todoId));
      return { success: true };
    }),

  // ERP: Todo löschen (nur ERP-Nutzer)
  deleteTodo: protectedProcedure
    .input(z.object({ todoId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db
        .delete(projectTodos)
        .where(eq(projectTodos.id, input.todoId));
      return { success: true };
    }),
});
