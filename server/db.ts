import { eq, desc, and, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  customers, InsertCustomer,
  leadSources, InsertLeadSource,
  projects, InsertProject,
  projectItems, InsertProjectItem,
  suppliers, InsertSupplier,
  rfqs, InsertRfq,
  rfqResponses, InsertRfqResponse,
  shipments, InsertShipment,
  cadFiles, InsertCadFile,
  consultationEntries, InsertConsultationEntry,
  materialsLibrary, InsertMaterialEntry,
  knowledgeEntries, InsertKnowledgeEntry,
  imageLibrary, InsertImageLibraryEntry,
  aiSessions, InsertAiSession,
  quickNotes,
  notes, noteAttachments, noteReminders,
  complaints, complaintAttachments, InsertComplaint, InsertComplaintAttachment,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date().toISOString() as any;
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date().toISOString() as any;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Customers ────────────────────────────────────────────────────────────────
export async function getCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(customers).values(data);
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(customers).where(eq(customers.id, id));
}

// ─── Lead Sources ─────────────────────────────────────────────────────────────
export async function getLeadSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadSources).orderBy(leadSources.name);
}

export async function createLeadSource(data: InsertLeadSource) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(leadSources).values(data);
}

export async function updateLeadSource(id: number, data: Partial<InsertLeadSource>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leadSources).set(data).where(eq(leadSources.id, id));
}

export async function deleteLeadSource(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(leadSources).where(eq(leadSources.id, id));
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function getProjects(filters?: { status?: string; type?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(projects.status, filters.status as any));
  if (filters?.type) conditions.push(eq(projects.type, filters.type as any));
  const query = conditions.length > 0
    ? db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.createdAt))
    : db.select().from(projects).orderBy(desc(projects.createdAt));
  return query;
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data);
  return result;
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set({ ...data, updatedAt: new Date().toISOString() as any }).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projects).where(eq(projects.id, id));
}

// Recalculate project totals from items
export async function recalcProjectTotals(projectId: number) {
  const db = await getDb();
  if (!db) return;
  const items = await db.select().from(projectItems).where(eq(projectItems.projectId, projectId));
  let totalEk = 0;
  let totalVk = 0;
  for (const item of items) {
    totalEk += parseFloat(item.totalEk ?? "0");
    totalVk += parseFloat(item.totalVk ?? "0");
  }
  const margin = totalVk - totalEk;
  const marginPct = totalVk > 0 ? (margin / totalVk) * 100 : 0;
  await db.update(projects).set({
    totalEk: totalEk.toFixed(2),
    totalVk: totalVk.toFixed(2),
    totalMargin: margin.toFixed(2),
    marginPercent: marginPct.toFixed(2),
  }).where(eq(projects.id, projectId));
}

// ─── Project Items ────────────────────────────────────────────────────────────
export async function getProjectItems(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectItems).where(eq(projectItems.projectId, projectId)).orderBy(projectItems.sortOrder);
}

export async function createProjectItem(data: InsertProjectItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const qty = data.quantity ?? 1;
  const unitEk = parseFloat(data.unitEk ?? "0");
  const unitVk = parseFloat(data.unitVk ?? "0");
  const totalEk = (unitEk * qty).toFixed(2);
  const totalVk = (unitVk * qty).toFixed(2);
  const marginPct = unitVk > 0 ? (((unitVk - unitEk) / unitVk) * 100).toFixed(2) : "0.00";
  await db.insert(projectItems).values({ ...data, totalEk, totalVk, marginPercent: marginPct });
  await recalcProjectTotals(data.projectId);
}

export async function updateProjectItem(id: number, data: Partial<InsertProjectItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(projectItems).where(eq(projectItems.id, id)).limit(1);
  if (!existing[0]) throw new Error("Item not found");
  const qty = data.quantity ?? existing[0].quantity ?? 1;
  const unitEk = parseFloat(data.unitEk ?? existing[0].unitEk ?? "0");
  const unitVk = parseFloat(data.unitVk ?? existing[0].unitVk ?? "0");
  const totalEk = (unitEk * qty).toFixed(2);
  const totalVk = (unitVk * qty).toFixed(2);
  const marginPct = unitVk > 0 ? (((unitVk - unitEk) / unitVk) * 100).toFixed(2) : "0.00";
  await db.update(projectItems).set({ ...data, totalEk, totalVk, marginPercent: marginPct }).where(eq(projectItems.id, id));
  await recalcProjectTotals(existing[0].projectId);
}

export async function deleteProjectItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(projectItems).where(eq(projectItems.id, id)).limit(1);
  if (!existing[0]) return;
  await db.delete(projectItems).where(eq(projectItems.id, id));
  await recalcProjectTotals(existing[0].projectId);
}

// ─── Suppliers ────────────────────────────────────────────────────────────────
export async function getSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).orderBy(desc(suppliers.rating));
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0];
}

export async function createSupplier(data: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(suppliers).values(data);
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(suppliers).where(eq(suppliers.id, id));
}

// ─── RFQ ──────────────────────────────────────────────────────────────────────
export async function getRfqsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rfqs).where(eq(rfqs.projectId, projectId)).orderBy(desc(rfqs.createdAt));
}

export async function createRfq(data: InsertRfq) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(rfqs).values(data);
}

export async function updateRfq(id: number, data: Partial<InsertRfq>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(rfqs).set(data).where(eq(rfqs.id, id));
}

export async function getRfqResponses(rfqId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rfqResponses).where(eq(rfqResponses.rfqId, rfqId));
}

export async function createRfqResponse(data: InsertRfqResponse) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(rfqResponses).values(data);
}

export async function selectBestRfqResponse(rfqId: number, responseId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(rfqResponses).set({ isSelected: 0 as any }).where(eq(rfqResponses.rfqId, rfqId));
  await db.update(rfqResponses).set({ isSelected: 1 as any }).where(eq(rfqResponses.id, responseId));
}

// ─── Shipments ────────────────────────────────────────────────────────────────
export async function getShipmentsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shipments).where(eq(shipments.projectId, projectId)).orderBy(desc(shipments.createdAt));
}

export async function createShipment(data: InsertShipment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(shipments).values(data);
}

export async function updateShipment(id: number, data: Partial<InsertShipment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(shipments).set(data).where(eq(shipments.id, id));
}

// ─── CAD Files ────────────────────────────────────────────────────────────────
export async function getCadFilesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cadFiles).where(eq(cadFiles.projectId, projectId)).orderBy(desc(cadFiles.createdAt));
}

export async function createCadFile(data: InsertCadFile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(cadFiles).values(data);
}

export async function deleteCadFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(cadFiles).where(eq(cadFiles.id, id));
}

// ─── Consultation Entries ─────────────────────────────────────────────────────
export async function getConsultationEntries(filters?: { projectId?: number; customerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.projectId) conditions.push(eq(consultationEntries.projectId, filters.projectId));
  if (filters?.customerId) conditions.push(eq(consultationEntries.customerId, filters.customerId));
  const query = conditions.length > 0
    ? db.select().from(consultationEntries).where(and(...conditions)).orderBy(desc(consultationEntries.createdAt))
    : db.select().from(consultationEntries).orderBy(desc(consultationEntries.createdAt));
  return query;
}

export async function createConsultationEntry(data: InsertConsultationEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(consultationEntries).values(data);
}

export async function updateConsultationEntry(id: number, data: Partial<InsertConsultationEntry>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(consultationEntries).set(data).where(eq(consultationEntries.id, id));
}

export async function deleteConsultationEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(consultationEntries).where(eq(consultationEntries.id, id));
}

// ─── Materials Library ────────────────────────────────────────────────────────
export async function getMaterials() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialsLibrary).orderBy(materialsLibrary.name);
}

export async function createMaterial(data: InsertMaterialEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(materialsLibrary).values(data);
}

export async function updateMaterial(id: number, data: Partial<InsertMaterialEntry>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(materialsLibrary).set(data).where(eq(materialsLibrary.id, id));
}

export async function deleteMaterial(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(materialsLibrary).where(eq(materialsLibrary.id, id));
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────
export async function getKnowledgeEntries(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.isActive, 1 as any),
        sql`(${knowledgeEntries.title} LIKE ${`%${search}%`} OR ${knowledgeEntries.content} LIKE ${`%${search}%`})`
      ))
      .orderBy(desc(knowledgeEntries.useCount));
  }
  return db.select().from(knowledgeEntries).where(eq(knowledgeEntries.isActive, 1 as any)).orderBy(desc(knowledgeEntries.useCount));
}

export async function createKnowledgeEntry(data: InsertKnowledgeEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(knowledgeEntries).values(data);
}

export async function updateKnowledgeEntry(id: number, data: Partial<InsertKnowledgeEntry>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(knowledgeEntries).set(data).where(eq(knowledgeEntries.id, id));
}

export async function deleteKnowledgeEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id));
}

// ─── Image Library ────────────────────────────────────────────────────────────
export async function getImageLibrary(category?: string) {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(imageLibrary).where(eq(imageLibrary.category, category as any)).orderBy(desc(imageLibrary.createdAt));
  }
  return db.select().from(imageLibrary).orderBy(desc(imageLibrary.createdAt));
}

export async function createImageEntry(data: InsertImageLibraryEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(imageLibrary).values(data);
}

export async function deleteImageEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(imageLibrary).where(eq(imageLibrary.id, id));
}

// ─── AI Sessions ──────────────────────────────────────────────────────────────
export async function getAiSessions(projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (projectId) {
    return db.select().from(aiSessions).where(eq(aiSessions.projectId, projectId)).orderBy(desc(aiSessions.createdAt));
  }
  return db.select().from(aiSessions).orderBy(desc(aiSessions.createdAt));
}

export async function createAiSession(data: InsertAiSession) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(aiSessions).values(data);
  return result;
}

export async function updateAiSession(id: number, data: Partial<InsertAiSession>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(aiSessions).set(data).where(eq(aiSessions.id, id));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  const allProjects = await db.select().from(projects);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyProjects = allProjects.filter(p => new Date(p.createdAt) >= startOfMonth);

  const totalEk = allProjects.reduce((s, p) => s + parseFloat(p.totalEk ?? "0"), 0);
  const totalVk = allProjects.reduce((s, p) => s + parseFloat(p.totalVk ?? "0"), 0);
  const monthlyEk = monthlyProjects.reduce((s, p) => s + parseFloat(p.totalEk ?? "0"), 0);
  const monthlyVk = monthlyProjects.reduce((s, p) => s + parseFloat(p.totalVk ?? "0"), 0);

  const statusCounts: Record<string, number> = {};
  for (const p of allProjects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }

  return {
    totalProjects: allProjects.length,
    openProjects: allProjects.filter(p => !["completed", "cancelled"].includes(p.status)).length,
    totalEk: totalEk.toFixed(2),
    totalVk: totalVk.toFixed(2),
    totalMargin: (totalVk - totalEk).toFixed(2),
    totalMarginPct: totalVk > 0 ? (((totalVk - totalEk) / totalVk) * 100).toFixed(1) : "0.0",
    monthlyEk: monthlyEk.toFixed(2),
    monthlyVk: monthlyVk.toFixed(2),
    monthlyMargin: (monthlyVk - monthlyEk).toFixed(2),
    statusCounts,
  };
}

// ─── Quick Notes ──────────────────────────────────────────────────────────────
export async function getQuickNotes(limit = 50, projectId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  if (projectId !== undefined && projectId !== null) {
    return db.select().from(quickNotes).where(eq(quickNotes.projectId, projectId)).orderBy(desc(quickNotes.createdAt)).limit(limit);
  }
  return db.select().from(quickNotes).orderBy(desc(quickNotes.createdAt)).limit(limit);
}

export async function createQuickNote(data: { text: string; projectId?: number | null; source?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(quickNotes).values({
    text: data.text,
    projectId: data.projectId ?? null,
    source: (data.source as any) ?? "sonstiges",
  });
}

export async function deleteQuickNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(quickNotes).where(eq(quickNotes.id, id));
}

// ─── Full Data Export ─────────────────────────────────────────────────────────
export async function getFullExport() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [
    allCustomers, allProjects, allProjectItems, allSuppliers,
    allLeadSources, allShipments, allConsultations, allMaterials,
    allKnowledge, allQuickNotes,
  ] = await Promise.all([
    db.select().from(customers),
    db.select().from(projects),
    db.select().from(projectItems),
    db.select().from(suppliers),
    db.select().from(leadSources),
    db.select().from(shipments),
    db.select().from(consultationEntries),
    db.select().from(materialsLibrary),
    db.select().from(knowledgeEntries),
    db.select().from(quickNotes),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    customers: allCustomers,
    projects: allProjects,
    projectItems: allProjectItems,
    suppliers: allSuppliers,
    leadSources: allLeadSources,
    shipments: allShipments,
    consultations: allConsultations,
    materials: allMaterials,
    knowledge: allKnowledge,
    quickNotes: allQuickNotes,
  };
}

// ─── Notes ───────────────────────────────────────────────────────────────────
export async function getNotes(status?: string, projectId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [];
  if (status) conditions.push(eq(notes.status, status as any));
  if (projectId !== undefined && projectId !== null) conditions.push(eq(notes.projectId, projectId));
  if (conditions.length > 0) {
    return await db.select().from(notes).where(and(...conditions)).orderBy(desc(notes.createdAt));
  }
  return await db.select().from(notes).orderBy(desc(notes.createdAt));
}

export async function getNoteById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result[0];
}

export async function createNote(data: { title: string; content?: string; projectId?: number | null; priority?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notes).values({
    title: data.title,
    content: data.content ?? null,
    projectId: data.projectId ?? null,
    priority: (data.priority as any) ?? "normal",
  });
}

export async function updateNote(id: number, data: { title?: string; content?: string; status?: string; priority?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notes).set(data as any).where(eq(notes.id, id));
}

export async function deleteNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(noteAttachments).where(eq(noteAttachments.noteId, id));
  await db.delete(noteReminders).where(eq(noteReminders.noteId, id));
  await db.delete(notes).where(eq(notes.id, id));
}

export async function getNoteAttachments(noteId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return await db.select().from(noteAttachments).where(eq(noteAttachments.noteId, noteId));
}

export async function addNoteAttachment(data: { noteId: number; filename: string; fileUrl: string; fileKey: string; fileType: string; fileSize?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(noteAttachments).values({
    noteId: data.noteId,
    filename: data.filename,
    fileUrl: data.fileUrl,
    fileKey: data.fileKey,
    fileType: (data.fileType as any) ?? "other",
    fileSize: data.fileSize ?? null,
  });
}

export async function deleteNoteAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(noteAttachments).where(eq(noteAttachments.id, id));
}

export async function getNoteReminders(noteId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return await db.select().from(noteReminders).where(eq(noteReminders.noteId, noteId));
}

export async function addNoteReminder(data: { noteId: number; label?: string; remindAt: Date | string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const remindAt = typeof data.remindAt === 'string' ? data.remindAt : data.remindAt.toISOString().slice(0, 19).replace('T', ' ');
  await db.insert(noteReminders).values({
    noteId: data.noteId,
    label: data.label ?? null,
    remindAt: remindAt as any,
  });
}

export async function deleteNoteReminder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(noteReminders).where(eq(noteReminders.id, id));
}

export async function getPendingReminders() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return await db.select().from(noteReminders)
    .where(eq(noteReminders.isSent, 0 as any));
}

export async function markReminderSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(noteReminders).set({ isSent: 1 as any }).where(eq(noteReminders.id, id));
}

// ─── Complaints ───────────────────────────────────────────────────────────────
export async function getComplaintsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(complaints).where(eq(complaints.projectId, projectId)).orderBy(complaints.createdAt);
  const attachmentRows = await db.select().from(complaintAttachments);
  return rows.map(c => ({
    ...c,
    attachments: attachmentRows.filter(a => a.complaintId === c.id),
  }));
}

export async function createComplaint(data: InsertComplaint) {
  const db = await getDb();
  if (!db) return;
  await db.insert(complaints).values(data);
}

export async function updateComplaint(id: number, data: Partial<InsertComplaint>) {
  const db = await getDb();
  if (!db) return;
  await db.update(complaints).set(data).where(eq(complaints.id, id));
}

export async function deleteComplaint(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(complaintAttachments).where(eq(complaintAttachments.complaintId, id));
  await db.delete(complaints).where(eq(complaints.id, id));
}

export async function addComplaintAttachment(data: InsertComplaintAttachment) {
  const db = await getDb();
  if (!db) return;
  await db.insert(complaintAttachments).values(data);
}

export async function deleteComplaintAttachment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(complaintAttachments).where(eq(complaintAttachments.id, id));
}
