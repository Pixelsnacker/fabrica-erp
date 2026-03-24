import crypto from "crypto";
import { eq, desc, and, like, sql, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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
  invoices, invoiceItems, invoiceAuditLog, invoiceSequences,
  InsertInvoice, InsertInvoiceItem, InsertInvoiceAuditLog,
  companySettings, InsertCompanySettings,
  projectDocuments,
  inquiries, inquiryItems, InsertInquiry, InsertInquiryItem,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

export function resetDb() {
  _db = null;
  _pool = null;
}

export async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!_db || !_pool) {
    try {
      // Connection Pool statt einzelner Verbindung - verhindert ECONNRESET/ETIMEDOUT
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 10000,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to create pool:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

// Wrapper: führt eine DB-Operation aus, bei ECONNRESET/ETIMEDOUT einmal neu verbinden und wiederholen
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const code = err?.cause?.code ?? err?.code ?? '';
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
      console.warn('[Database] Connection lost, reconnecting...', code);
      resetDb();
      // Kurz warten und neu verbinden
      await new Promise(r => setTimeout(r, 200));
      return await fn();
    }
    throw err;
  }
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
  // Automatische Kundennummer vergeben wenn keine angegeben
  if (!data.customerNumber) {
    const settings = await getCompanySettings();
    const startNum = settings?.customerStartNumber ?? 10000;
    // Höchste bestehende Kundennummer ermitteln
    const rows = await db.select({ num: customers.customerNumber }).from(customers).orderBy(desc(customers.customerNumber)).limit(1);
    const lastNum = rows[0]?.num ?? 0;
    data = { ...data, customerNumber: Math.max(lastNum + 1, startNum) };
  }
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
  const project = result[0];
  if (!project) return undefined;
  // Customer oder Supplier als 'customer'-Objekt anreichern
  let customerObj: any = null;
  if (project.customerId) {
    const cRows = await db.select().from(customers).where(eq(customers.id, project.customerId)).limit(1);
    customerObj = cRows[0] ?? null;
  } else if ((project as any).supplierId) {
    const sRows = await db.select().from(suppliers).where(eq(suppliers.id, (project as any).supplierId)).limit(1);
    if (sRows[0]) {
      // Lieferant als customer-kompatibles Objekt
      customerObj = { ...sRows[0], _isSupplier: true };
    }
  }
  return { ...project, customer: customerObj };
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

  // Zuerst alle abhängigen Daten löschen (cascade)
  // 1. Reklamations-Anhänge
  const projectComplaints = await db.select({ id: complaints.id }).from(complaints).where(eq(complaints.projectId, id));
  for (const c of projectComplaints) {
    await db.delete(complaintAttachments).where(eq(complaintAttachments.complaintId, c.id));
  }
  await db.delete(complaints).where(eq(complaints.projectId, id));

  // 2. Notiz-Anhänge und Erinnerungen
  const projectNotes = await db.select({ id: notes.id }).from(notes).where(eq(notes.projectId, id));
  for (const n of projectNotes) {
    await db.delete(noteAttachments).where(eq(noteAttachments.noteId, n.id));
    await db.delete(noteReminders).where(eq(noteReminders.noteId, n.id));
  }
  await db.delete(notes).where(eq(notes.projectId, id));

  // 3. RFQ-Antworten und RFQs
  const projectRfqs = await db.select({ id: rfqs.id }).from(rfqs).where(eq(rfqs.projectId, id));
  for (const r of projectRfqs) {
    await db.delete(rfqResponses).where(eq(rfqResponses.rfqId, r.id));
  }
  await db.delete(rfqs).where(eq(rfqs.projectId, id));

  // 4. Positionen (project_items)
  await db.delete(projectItems).where(eq(projectItems.projectId, id));

  // 5. Versand, CAD-Dateien, Beratung, Schnellnotizen, AI-Sessions
  await db.delete(shipments).where(eq(shipments.projectId, id));
  await db.delete(cadFiles).where(eq(cadFiles.projectId, id));
  await db.delete(consultationEntries).where(eq(consultationEntries.projectId, id));
  await db.delete(quickNotes).where(eq(quickNotes.projectId, id));
  await db.delete(aiSessions).where(eq(aiSessions.projectId, id));

  // 6. Projekt-Dokumente
  await db.delete(projectDocuments).where(eq(projectDocuments.projectId, id));

  // 7. Schließlich das Projekt selbst
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
export async function updateQuickNote(id: number, data: { text?: string; source?: string; remindAt?: string | null; remindLabel?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const update: Record<string, any> = {};
  if (data.text !== undefined) update.text = data.text;
  if (data.source !== undefined) update.source = data.source;
  if (data.remindAt !== undefined) update.remindAt = data.remindAt;
  if (data.remindLabel !== undefined) update.remindLabel = data.remindLabel;
  await db.update(quickNotes).set(update).where(eq(quickNotes.id, id));
}
export async function getDueQuickNoteReminders() {
  const db = await getDb();
  if (!db) return [];
  const { lte, isNotNull, and } = await import('drizzle-orm');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return db.select().from(quickNotes)
    .where(and(isNotNull(quickNotes.remindAt), lte(quickNotes.remindAt, now)))
    .orderBy(quickNotes.remindAt);
}
export async function markQuickNoteReminderSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(quickNotes).set({ remindSent: 1, remindAt: null }).where(eq(quickNotes.id, id));
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

export async function createNote(data: { title: string; content?: string; projectId?: number | null; priority?: string; source?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notes).values({
    title: data.title,
    content: data.content ?? null,
    projectId: data.projectId ?? null,
    priority: (data.priority as any) ?? "normal",
    source: (data.source as any) ?? "sonstiges",
  });
}

export async function updateNote(id: number, data: { title?: string; content?: string; status?: string; priority?: string; source?: string | null }) {
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
  // Speichere als MySQL-kompatiblen String ohne Timezone-Konvertierung
  // Input kann sein: 'YYYY-MM-DDTHH:MM' (datetime-local) oder ISO-String
  let remindAt: string;
  if (typeof data.remindAt === 'string') {
    // Entferne Z-Suffix falls vorhanden, ersetze T durch Leerzeichen für MySQL
    remindAt = data.remindAt.replace('Z', '').replace('T', ' ').slice(0, 19);
  } else {
    // Date-Objekt: als lokale Zeit speichern (nicht UTC)
    const d = data.remindAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    remindAt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
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

/**
 * Gibt alle fälligen Erinnerungen zurück (remindAt <= jetzt, isSent = 0)
 * inkl. Notiz-Titel für die Benachrichtigung
 */
export async function getDueNoteReminders() {
  const db = await getDb();
  if (!db) return [];
  // Verwende MySQL NOW() für korrekten UTC-Zeitzonenvergleich
  const rows = await db
    .select({
      id: noteReminders.id,
      label: noteReminders.label,
      remindAt: noteReminders.remindAt,
      noteId: noteReminders.noteId,
      noteTitle: notes.title,
      noteContent: notes.content,
    })
    .from(noteReminders)
    .innerJoin(notes, eq(noteReminders.noteId, notes.id))
    .where(and(
      eq(noteReminders.isSent, 0 as any),
      sql`${noteReminders.remindAt} <= NOW()`,
    ));
  return rows;
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

export async function getAllComplaints() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: complaints.id,
      projectId: complaints.projectId,
      title: complaints.title,
      description: complaints.description,
      status: complaints.status,
      priority: complaints.priority,
      resolution: complaints.resolution,
      resolvedAt: complaints.resolvedAt,
      createdAt: complaints.createdAt,
      projectTitle: projects.title,
      projectNumber: projects.projectNumber,
    })
    .from(complaints)
    .leftJoin(projects, eq(complaints.projectId, projects.id))
    .orderBy(
      sql`CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      complaints.createdAt
    );
  return rows;
}

// ─── Invoice Module ───────────────────────────────────────────────────────────

/** Atomare Nummernvergabe – sicher gegen Race Conditions, Präfix aus Firmeneinstellungen */
export async function getNextInvoiceNumber(type: 'invoice' | 'offer' | 'credit_note' | 'order_confirmation' | 'purchase_order' | 'delivery_note'): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const year = new Date().getFullYear();

  // Firmeneinstellungen für Präfix und Format laden
  const settings = await getCompanySettings();
  const sep = settings?.numberSeparator ?? '-';
  const padding = settings?.numberPadding ?? 4;
  const includeYear = (settings?.includeYear ?? 1) === 1;
  const prefix = type === 'invoice'
    ? (settings?.invoicePrefix ?? 'RE')
    : type === 'offer'
      ? (settings?.offerPrefix ?? 'AN')
      : type === 'order_confirmation'
        ? 'AB'
        : type === 'purchase_order'
          ? 'BE'
          : type === 'delivery_note'
            ? (settings?.deliveryNotePrefix ?? 'LS')
            : (settings?.creditNotePrefix ?? 'GS');

  // Startnummer aus Einstellungen lesen
  const startNum = type === 'invoice'
    ? (settings?.invoiceStartNumber ?? 1)
    : type === 'offer'
      ? (settings?.offerStartNumber ?? 1)
      : type === 'order_confirmation' || type === 'purchase_order'
        ? 1
        : type === 'delivery_note'
          ? (settings?.deliveryNoteStartNumber ?? 1)
          : (settings?.creditNoteStartNumber ?? 1);
  // Prüfen ob bereits ein Eintrag für dieses Jahr existiert
  const existing = await db.select().from(invoiceSequences)
    .where(and(eq(invoiceSequences.year, year), eq(invoiceSequences.type, type)));
  if (existing.length === 0) {
    // Erster Eintrag: mit Startnummer aus Einstellungen beginnen
    await db.execute(
      sql`INSERT INTO invoice_sequences (year, type, last_number) VALUES (${year}, ${type}, ${startNum})
          ON DUPLICATE KEY UPDATE last_number = last_number + 1`
    );
  } else {
    // Bereits vorhanden: hochzählen, aber mindestens den Einstellungs-Startwert verwenden
    const currentNum = existing[0]?.lastNumber ?? 0;
    if (currentNum < startNum) {
      // Einstellungs-Startwert ist höher als aktuelle Sequenz → auf Startwert springen
      await db.execute(
        sql`INSERT INTO invoice_sequences (year, type, last_number) VALUES (${year}, ${type}, ${startNum})
            ON DUPLICATE KEY UPDATE last_number = ${startNum}`
      );
    } else {
      // Normal hochzählen
      await db.execute(
        sql`INSERT INTO invoice_sequences (year, type, last_number) VALUES (${year}, ${type}, 1)
            ON DUPLICATE KEY UPDATE last_number = last_number + 1`
      );
    }
  }
  const rows = await db.select().from(invoiceSequences)
    .where(and(eq(invoiceSequences.year, year), eq(invoiceSequences.type, type)));
  const num = rows[0]?.lastNumber ?? startNum;
  const paddedNum = String(num).padStart(padding, '0');

  if (includeYear) {
    return `${prefix}${sep}${year}${sep}${paddedNum}`;
  }
  return `${prefix}${sep}${paddedNum}`;
}

export async function getInvoices(filters?: { type?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(invoices);
  const rows = await query.orderBy(desc(invoices.createdAt));
  return rows.filter(r => {
    if (filters?.type && r.type !== filters.type) return false;
    if (filters?.status && r.status !== filters.status) return false;
    return true;
  });
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!rows[0]) return null;
  const items = await db.select().from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(invoiceItems.position);
  const auditLog = await db.select().from(invoiceAuditLog)
    .where(eq(invoiceAuditLog.invoiceId, id))
    .orderBy(invoiceAuditLog.changedAt);
  return { ...rows[0], items, auditLog };
}

export async function createInvoice(data: InsertInvoice, items: InsertInvoiceItem[], changedBy: string) {
  return withRetry(async () => {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  await db.insert(invoices).values({ ...data, createdAt: now, updatedAt: now });
  const created = await db.select().from(invoices).where(eq(invoices.invoiceNumber, data.invoiceNumber!));
  const invoiceId = created[0]?.id;
  if (!invoiceId) return;
  // Items einfügen - alle auf einmal statt einzeln (verhindert Connection-Drops)
  if (items.length > 0) {
    await db.insert(invoiceItems).values(items.map(item => ({ ...item, invoiceId })));
  }
  // Audit-Log
  await db.insert(invoiceAuditLog).values({
    invoiceId,
    action: 'created',
    changedBy,
    changedAt: now,
    snapshotJson: JSON.stringify({ ...data, items }),
  });
  return invoiceId;
  }); // end withRetry
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>, items: InsertInvoiceItem[] | null, changedBy: string) {
  return withRetry(async () => {
  const db = await getDb();
  if (!db) return;
  // Gesperrte Rechnungen nicht änderbar
  const existing = await db.select().from(invoices).where(eq(invoices.id, id));
  if (existing[0]?.isLocked) throw new Error("LOCKED: Finalisierte Rechnungen können nicht geändert werden.");
  const now = Date.now();
  await db.update(invoices).set({ ...data, updatedAt: now }).where(eq(invoices.id, id));
  if (items !== null) {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    // Alle Items auf einmal einfügen (verhindert Connection-Drops bei vielen Positionen)
    if (items.length > 0) {
      await db.insert(invoiceItems).values(items.map(item => ({ ...item, invoiceId: id })));
    }
  }
  await db.insert(invoiceAuditLog).values({
    invoiceId: id,
    action: 'updated',
    changedBy,
    changedAt: now,
    snapshotJson: JSON.stringify({ ...data, items }),
  });
  }); // end withRetry
}

export async function changeInvoiceStatus(id: number, newStatus: string, changedBy: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(invoices).where(eq(invoices.id, id));
  const oldStatus = existing[0]?.status;
  const now = Date.now();
  await db.update(invoices).set({ status: newStatus as any, updatedAt: now }).where(eq(invoices.id, id));
  await db.insert(invoiceAuditLog).values({
    invoiceId: id,
    action: 'status_changed',
    changedBy,
    changedAt: now,
    fieldChanged: 'status',
    oldValue: oldStatus ?? '',
    newValue: newStatus,
  });
}

export async function lockInvoice(id: number, pdfUrl: string, pdfKey: string, changedBy: string) {
  const db = await getDb();
  if (!db) return;
  const inv = await getInvoiceById(id);
  if (!inv) return;
  // SHA-256 Hash über Rechnungsinhalt
  const hashInput = JSON.stringify({
    invoiceNumber: inv.invoiceNumber,
    type: inv.type,
    customerId: inv.customerId,
    items: inv.items,
    subtotalNet: inv.subtotalNet,
    taxAmount: inv.taxAmount,
    totalGross: inv.totalGross,
    issueDate: inv.issueDate,
  });
  const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const now = Date.now();
  await db.update(invoices).set({
    isLocked: 1,
    pdfUrl,
    pdfKey,
    contentHash,
    status: 'invoiced' as any,
    updatedAt: now,
  }).where(eq(invoices.id, id));
  await db.insert(invoiceAuditLog).values({
    invoiceId: id,
    action: 'locked',
    changedBy,
    changedAt: now,
    newValue: contentHash,
    snapshotJson: hashInput,
  });
}

export async function cancelInvoice(id: number, changedBy: string) {
  const db = await getDb();
  if (!db) return;
  const inv = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!inv[0]) return;
  // Stornierung: Original auf 'cancelled' setzen
  const now = Date.now();
  await db.update(invoices).set({ status: 'cancelled' as any, updatedAt: now }).where(eq(invoices.id, id));
  // Gutschrift anlegen
  const creditNumber = await getNextInvoiceNumber('credit_note');
  await db.insert(invoices).values({
    invoiceNumber: creditNumber,
    type: 'credit_note',
    status: 'invoiced' as any,
    customerId: inv[0].customerId,
    projectId: inv[0].projectId,
    senderName: inv[0].senderName,
    senderStreet: inv[0].senderStreet,
    senderZip: inv[0].senderZip,
    senderCity: inv[0].senderCity,
    senderTaxId: inv[0].senderTaxId,
    senderVatId: inv[0].senderVatId,
    senderEmail: inv[0].senderEmail,
    senderPhone: inv[0].senderPhone,
    senderIban: inv[0].senderIban,
    senderBic: inv[0].senderBic,
    recipientName: inv[0].recipientName,
    recipientCompany: inv[0].recipientCompany,
    recipientStreet: inv[0].recipientStreet,
    recipientZip: inv[0].recipientZip,
    recipientCity: inv[0].recipientCity,
    recipientEmail: inv[0].recipientEmail,
    issueDate: new Date().toISOString().slice(0, 10),
    taxMode: inv[0].taxMode,
    subtotalNet: inv[0].subtotalNet,
    taxAmount: inv[0].taxAmount,
    totalGross: inv[0].totalGross,
    currency: inv[0].currency,
    notes: `Gutschrift zu ${inv[0].invoiceNumber}`,
    cancelsInvoice: id,
    isLocked: 1,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(invoiceAuditLog).values({
    invoiceId: id,
    action: 'cancelled',
    changedBy,
    changedAt: now,
    newValue: creditNumber,
  });
}

export async function deleteInvoiceDraft(id: number) {
  const db = await getDb();
  if (!db) return;
  const inv = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!inv[0]) return;
  // Gesperrte Dokumente können nie gelöscht werden
  if (inv[0].isLocked) throw new Error("Gesperrte Dokumente können nicht gelöscht werden.");
  // Rechnungen/Gutschriften/AB: nur im Entwurf löschbar (GoBD)
  const requiresDraft = ['invoice', 'credit_note', 'order_confirmation'].includes(inv[0].type ?? '');
  if (requiresDraft && inv[0].status !== 'draft') throw new Error("Nur Entwürfe können gelöscht werden.");
  // Angebote, Bestellungen, Lieferscheine: immer löschbar
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db.delete(invoices).where(eq(invoices.id, id));
}

/** Vergibt die nächste fortlaufende Nummer an einen Entwurf (z.B. beim Senden einer Rechnung) */
export async function assignInvoiceNumber(id: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const inv = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv[0] || inv[0].invoiceNumber !== 'ENTWURF') return inv[0]?.invoiceNumber ?? null;
  const newNumber = await getNextInvoiceNumber(inv[0].type as any);
  await db.update(invoices).set({ invoiceNumber: newNumber, updatedAt: Date.now() }).where(eq(invoices.id, id));
  return newNumber;
}

export async function getInvoiceAuditLog(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceAuditLog)
    .where(eq(invoiceAuditLog.invoiceId, invoiceId))
    .orderBy(invoiceAuditLog.changedAt);
}

// ─── Company Settings ────────────────────────────────────────────────────────────
export async function getCompanySettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(companySettings).limit(1);
  return rows[0] ?? null;
}
export async function upsertCompanySettings(data: Partial<InsertCompanySettings>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const now = Date.now();
  const existing = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
  if (existing.length > 0) {
    await db.update(companySettings).set({ ...data, updatedAt: now }).where(eq(companySettings.id, 1));
  } else {
    await db.insert(companySettings).values({ id: 1, ...data, createdAt: now, updatedAt: now } as any);
  }
  return getCompanySettings();
}

// ─── Kalender ─────────────────────────────────────────────────────────────────
import { calendarEvents, InsertCalendarEvent } from "../drizzle/schema";

export async function listCalendarEvents(from: number, to: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(calendarEvents)
    .where(and(gte(calendarEvents.startAt, from), lte(calendarEvents.endAt, to)))
    .orderBy(calendarEvents.startAt);
}

export async function createCalendarEvent(data: InsertCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = Date.now();
  const [result] = await db.insert(calendarEvents).values({ ...data, createdAt: now, updatedAt: now });
  return result.insertId as number;
}

export async function updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(calendarEvents).set({ ...data, updatedAt: Date.now() }).where(eq(calendarEvents.id, id));
}

export async function deleteCalendarEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
}

export async function getCalendarEvent(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  return rows[0] ?? null;
}

// ─── Lieferantenanfragen ──────────────────────────────────────────────────────

export async function getNextInquiryNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const settings = await getCompanySettings();
  const prefix = settings?.inquiryPrefix ?? "ANF";
  const startNum = settings?.inquiryStartNumber ?? 1;
  const sep = settings?.numberSeparator ?? "-";
  const padding = settings?.numberPadding ?? 4;
  const year = new Date().getFullYear();

  // Höchste laufende Nummer im aktuellen Jahr ermitteln
  const pattern = `${prefix}${sep}${year}${sep}%`;
  const rows = await db.select({ num: inquiries.inquiryNumber })
    .from(inquiries)
    .where(like(inquiries.inquiryNumber, pattern))
    .orderBy(desc(inquiries.inquiryNumber))
    .limit(1);

  let nextNum = startNum;
  if (rows.length > 0) {
    const parts = rows[0].num.split(sep);
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) nextNum = Math.max(last + 1, startNum);
  }
  return `${prefix}${sep}${year}${sep}${String(nextNum).padStart(padding, "0")}`;
}

export async function listInquiries(filters?: { status?: string; supplierId?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  return query;
}

export async function getInquiryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getInquiryItems(inquiryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inquiryItems).where(eq(inquiryItems.inquiryId, inquiryId)).orderBy(inquiryItems.position);
}

export async function createInquiry(data: Omit<InsertInquiry, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = Date.now();
  const [result] = await db.insert(inquiries).values({ ...data, createdAt: now, updatedAt: now } as any);
  return (result as any).insertId as number;
}

export async function updateInquiry(id: number, data: Partial<InsertInquiry>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(inquiries).set({ ...data, updatedAt: Date.now() } as any).where(eq(inquiries.id, id));
}

export async function deleteInquiry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(inquiryItems).where(eq(inquiryItems.inquiryId, id));
  await db.delete(inquiries).where(eq(inquiries.id, id));
}

export async function replaceInquiryItems(inquiryId: number, items: Array<Omit<InsertInquiryItem, "id" | "inquiryId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(inquiryItems).where(eq(inquiryItems.inquiryId, inquiryId));
  if (items.length > 0) {
    const now = Date.now();
    await db.insert(inquiryItems).values(items.map((item, i) => ({
      ...item,
      inquiryId,
      position: i + 1,
      createdAt: now,
    })) as any);
  }
}
