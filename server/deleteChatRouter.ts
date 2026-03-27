import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { storageDelete } from "./storage";

// Admin-only procedure: serverseitig auf role === 'admin' beschränkt
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Nur Administratoren können diese Aktion ausführen.",
    });
  }
  return next({ ctx });
});

export const deleteChatRouter = router({
  /**
   * Löscht alle Nachrichten und S3-Anhänge eines Projekts.
   * Schreibt einen Audit-Log-Eintrag.
   * Nur für Administratoren zugänglich.
   */
  deleteProjectChat: adminProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const { projectChatMessages, chatDeleteLog } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // 1. Alle Nachrichten des Projekts laden (für S3-Anhänge)
      const messages = await db
        .select({
          id: projectChatMessages.id,
          attachmentKey: projectChatMessages.attachmentKey,
        })
        .from(projectChatMessages)
        .where(eq(projectChatMessages.projectId, input.projectId));

      const messageCount = messages.length;
      const attachmentsToDelete = messages
        .filter((m) => m.attachmentKey && m.attachmentKey.trim() !== "")
        .map((m) => m.attachmentKey as string);
      const attachmentCount = attachmentsToDelete.length;

      // 2. S3-Anhänge löschen (Fehler werden ignoriert, damit DB-Löschung trotzdem läuft)
      for (const key of attachmentsToDelete) {
        try {
          await storageDelete(key);
        } catch (err) {
          // Log but continue — DB deletion must proceed
          console.warn(`[deleteChatRouter] S3 delete failed for key ${key}:`, err);
        }
      }

      // 3. Alle Nachrichten aus DB löschen
      if (messageCount > 0) {
        await db
          .delete(projectChatMessages)
          .where(eq(projectChatMessages.projectId, input.projectId));
      }

      // 4. Audit-Log-Eintrag schreiben
      await db.insert(chatDeleteLog).values({
        projectId: input.projectId,
        deletedBy: ctx.user.name ?? ctx.user.openId ?? "unknown",
        deletedAt: Date.now(),
        messageCount,
        attachmentCount,
      });

      return {
        success: true,
        messageCount,
        attachmentCount,
      };
    }),

  /**
   * Gibt die Lösch-Historie für ein Projekt zurück (Admin-only).
   */
  getDeleteLog: adminProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const { chatDeleteLog } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      return db
        .select()
        .from(chatDeleteLog)
        .where(eq(chatDeleteLog.projectId, input.projectId))
        .orderBy(desc(chatDeleteLog.deletedAt));
    }),
});
