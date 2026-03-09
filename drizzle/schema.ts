import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Lead Sources ─────────────────────────────────────────────────────────────
export const leadSources = mysqlTable("lead_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["website", "google_ads", "referral", "direct", "other"]).notNull().default("other"),
  monthlyCost: decimal("monthly_cost", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeadSource = typeof leadSources.$inferSelect;
export type InsertLeadSource = typeof leadSources.$inferInsert;

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  type: mysqlEnum("type", ["b2b", "museum", "industry", "private", "other"]).notNull().default("b2b"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  notes: text("notes"),
  sevdeskId: varchar("sevdesk_id", { length: 64 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  projectNumber: varchar("project_number", { length: 64 }),
  type: mysqlEnum("type", ["serial_part", "spare_part", "museum", "consulting", "cad_work", "other"]).notNull().default("other"),
  status: mysqlEnum("status", ["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"]).notNull().default("inquiry"),
  customerId: int("customer_id"),
  leadSourceId: int("lead_source_id"),
  driveFolderUrl: varchar("drive_folder_url", { length: 512 }),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  deadline: timestamp("deadline"),
  totalEk: decimal("total_ek", { precision: 10, scale: 2 }).default("0.00"),
  totalVk: decimal("total_vk", { precision: 10, scale: 2 }).default("0.00"),
  totalMargin: decimal("total_margin", { precision: 10, scale: 2 }).default("0.00"),
  marginPercent: decimal("margin_percent", { precision: 5, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project Items (Positionen) ───────────────────────────────────────────────
export const projectItems = mysqlTable("project_items", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  quantity: int("quantity").default(1).notNull(),
  material: varchar("material", { length: 255 }),
  technique: mysqlEnum("technique", ["3d_print", "cnc", "painting", "cad_work", "model_making", "assembly", "other"]).default("other"),
  productionType: mysqlEnum("production_type", ["in_house", "external"]).default("external").notNull(),
  unitEk: decimal("unit_ek", { precision: 10, scale: 2 }).default("0.00"),
  unitVk: decimal("unit_vk", { precision: 10, scale: 2 }).default("0.00"),
  totalEk: decimal("total_ek", { precision: 10, scale: 2 }).default("0.00"),
  totalVk: decimal("total_vk", { precision: 10, scale: 2 }).default("0.00"),
  marginPercent: decimal("margin_percent", { precision: 5, scale: 2 }).default("0.00"),
  notes: text("notes"),
  sortOrder: int("sort_order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectItem = typeof projectItems.$inferSelect;
export type InsertProjectItem = typeof projectItems.$inferInsert;

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  capabilities: json("capabilities").$type<string[]>(),
  rating: int("rating").default(3),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ─── RFQ (Request for Quotation) ──────────────────────────────────────────────
export const rfqs = mysqlTable("rfqs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull(),
  projectItemId: int("project_item_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  deadline: timestamp("deadline"),
  status: mysqlEnum("status", ["draft", "sent", "responses_received", "completed"]).default("draft").notNull(),
  supplierIds: json("supplier_ids").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rfq = typeof rfqs.$inferSelect;
export type InsertRfq = typeof rfqs.$inferInsert;

// ─── RFQ Responses ────────────────────────────────────────────────────────────
export const rfqResponses = mysqlTable("rfq_responses", {
  id: int("id").autoincrement().primaryKey(),
  rfqId: int("rfq_id").notNull(),
  supplierId: int("supplier_id").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  deliveryDays: int("delivery_days"),
  notes: text("notes"),
  isSelected: boolean("is_selected").default(false).notNull(),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RfqResponse = typeof rfqResponses.$inferSelect;
export type InsertRfqResponse = typeof rfqResponses.$inferInsert;

// ─── Shipments ────────────────────────────────────────────────────────────────
export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull(),
  carrier: varchar("carrier", { length: 128 }),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  shippedAt: timestamp("shipped_at"),
  estimatedDelivery: timestamp("estimated_delivery"),
  deliveredAt: timestamp("delivered_at"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

// ─── CAD Files ────────────────────────────────────────────────────────────────
export const cadFiles = mysqlTable("cad_files", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull(),
  projectItemId: int("project_item_id"),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  fileUrl: varchar("file_url", { length: 1024 }).notNull(),
  fileSize: int("file_size"),
  mimeType: varchar("mime_type", { length: 128 }),
  version: int("version").default(1).notNull(),
  versionNote: text("version_note"),
  parentFileId: int("parent_file_id"),
  uploadedBy: varchar("uploaded_by", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CadFile = typeof cadFiles.$inferSelect;
export type InsertCadFile = typeof cadFiles.$inferInsert;

// ─── Consultation Entries (Beratungshistorie) ─────────────────────────────────
export const consultationEntries = mysqlTable("consultation_entries", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id"),
  customerId: int("customer_id"),
  type: mysqlEnum("type", ["material_advice", "process_advice", "technical_analysis", "offer_discussion", "general", "other"]).default("general").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>(),
  outcome: text("outcome"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConsultationEntry = typeof consultationEntries.$inferSelect;
export type InsertConsultationEntry = typeof consultationEntries.$inferInsert;

// ─── Materials Library (Materialien-Bibliothek) ───────────────────────────────
export const materialsLibrary = mysqlTable("materials_library", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["metal", "plastic", "composite", "surface_treatment", "process", "other"]).default("other").notNull(),
  properties: text("properties"),
  applications: text("applications"),
  advantages: text("advantages"),
  disadvantages: text("disadvantages"),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialEntry = typeof materialsLibrary.$inferSelect;
export type InsertMaterialEntry = typeof materialsLibrary.$inferInsert;

// ─── Knowledge Base (Wissensdatenbank) ───────────────────────────────────────
export const knowledgeEntries = mysqlTable("knowledge_entries", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["material", "surface_treatment", "process", "supplier_info", "project_type", "pricing", "general"]).default("general").notNull(),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>(),
  source: varchar("source", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  useCount: int("use_count").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type InsertKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

// ─── Image Library (Bilddatenbank) ───────────────────────────────────────────
export const imageLibrary = mysqlTable("image_library", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["material", "surface_treatment", "process", "reference", "product", "other"]).default("other").notNull(),
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  fileUrl: varchar("file_url", { length: 1024 }).notNull(),
  tags: json("tags").$type<string[]>(),
  useCount: int("use_count").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImageLibraryEntry = typeof imageLibrary.$inferSelect;
export type InsertImageLibraryEntry = typeof imageLibrary.$inferInsert;

// ─── AI Sessions (KI-Beratungssessions) ──────────────────────────────────────
export const aiSessions = mysqlTable("ai_sessions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id"),
  customerId: int("customer_id"),
  prompt: text("prompt").notNull(),
  generatedText: text("generated_text"),
  selectedImageIds: json("selected_image_ids").$type<number[]>(),
  usedKnowledgeIds: json("used_knowledge_ids").$type<number[]>(),
  sentAsEmail: boolean("sent_as_email").default(false).notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiSession = typeof aiSessions.$inferSelect;
export type InsertAiSession = typeof aiSessions.$inferInsert;

// ─── Quick Notes (Schnellnotizen aus WhatsApp/Telefon) ────────────────────────
export const quickNotes = mysqlTable("quick_notes", {
  id: int("id").autoincrement().primaryKey(),
  text: text("text").notNull(),
  projectId: int("project_id"),
  source: mysqlEnum("source", ["whatsapp", "telefon", "persoenlich", "email", "sonstiges"]).default("sonstiges").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuickNote = typeof quickNotes.$inferSelect;
export type InsertQuickNote = typeof quickNotes.$inferInsert;

// ─── Notes & Reminders ───────────────────────────────────────────────────────
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  projectId: int("project_id"),
  status: mysqlEnum("status", ["offen", "erledigt"]).default("offen").notNull(),
  priority: mysqlEnum("priority", ["niedrig", "normal", "hoch"]).default("normal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const noteAttachments = mysqlTable("note_attachments", {
  id: int("id").autoincrement().primaryKey(),
  noteId: int("note_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: mysqlEnum("file_type", ["image", "pdf", "other"]).default("other").notNull(),
  fileSize: int("file_size"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const noteReminders = mysqlTable("note_reminders", {
  id: int("id").autoincrement().primaryKey(),
  noteId: int("note_id").notNull(),
  label: varchar("label", { length: 255 }),
  remindAt: timestamp("remind_at").notNull(),
  isSent: boolean("is_sent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type NoteAttachment = typeof noteAttachments.$inferSelect;
export type NoteReminder = typeof noteReminders.$inferSelect;
