import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, text, json, timestamp, varchar, mysqlEnum, decimal, foreignKey, index, tinyint, boolean } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const aiSessions = mysqlTable("ai_sessions", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id"),
	customerId: int("customer_id"),
	prompt: text().notNull(),
	generatedText: text("generated_text"),
	selectedImageIds: json("selected_image_ids"),
	usedKnowledgeIds: json("used_knowledge_ids"),
	sentAsEmail: tinyint("sent_as_email").default(0).notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const cadFiles = mysqlTable("cad_files", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id").notNull(),
	projectItemId: int("project_item_id"),
	filename: varchar({ length: 512 }).notNull(),
	fileKey: varchar("file_key", { length: 512 }).notNull(),
	fileUrl: varchar("file_url", { length: 1024 }).notNull(),
	fileSize: int("file_size"),
	mimeType: varchar("mime_type", { length: 128 }),
	version: int().default(1).notNull(),
	versionNote: text("version_note"),
	parentFileId: int("parent_file_id"),
	uploadedBy: varchar("uploaded_by", { length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const consultationEntries = mysqlTable("consultation_entries", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id"),
	customerId: int("customer_id"),
	type: mysqlEnum(['material_advice','process_advice','technical_analysis','offer_discussion','general','other']).default('general').notNull(),
	title: varchar({ length: 512 }).notNull(),
	content: text().notNull(),
	tags: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	outcome: text(),
});

export const customers = mysqlTable("customers", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	company: varchar({ length: 255 }),
	type: mysqlEnum(['b2b','museum','industry','private','other']).default('b2b').notNull(),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 64 }),
	address: text(),
	notes: text(),
	sevdeskId: varchar("sevdesk_id", { length: 64 }),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const imageLibrary = mysqlTable("image_library", {
	id: int().autoincrement().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	category: mysqlEnum(['material','surface_treatment','process','reference','product','other']).default('other').notNull(),
	fileKey: varchar("file_key", { length: 512 }).notNull(),
	fileUrl: varchar("file_url", { length: 1024 }).notNull(),
	tags: json(),
	useCount: int("use_count").default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const knowledgeEntries = mysqlTable("knowledge_entries", {
	id: int().autoincrement().notNull(),
	title: varchar({ length: 255 }).notNull(),
	category: mysqlEnum(['material','surface_treatment','process','supplier_info','project_type','pricing','general']).default('general').notNull(),
	content: text().notNull(),
	tags: json(),
	source: varchar({ length: 255 }),
	isActive: tinyint("is_active").default(1).notNull(),
	useCount: int("use_count").default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const leadSources = mysqlTable("lead_sources", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	type: mysqlEnum(['website','google_ads','referral','direct','social','other']).default('website').notNull(),
	monthlyCost: decimal("monthly_cost", { precision: 10, scale: 2 }),
	notes: text(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const materialsLibrary = mysqlTable("materials_library", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	category: mysqlEnum(['plastic','metal','composite','surface_treatment','process','other']).default('other').notNull(),
	properties: text(),
	applications: text(),
	advantages: text(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	disadvantages: text(),
	tags: json(),
});

export const noteAttachments = mysqlTable("note_attachments", {
	id: int().autoincrement().notNull(),
	noteId: int("note_id").notNull(),
	filename: varchar({ length: 255 }).notNull(),
	fileUrl: text("file_url").notNull(),
	fileKey: text("file_key").notNull(),
	fileType: mysqlEnum("file_type", ['image','pdf','other']).default('other').notNull(),
	fileSize: int("file_size"),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const noteReminders = mysqlTable("note_reminders", {
	id: int().autoincrement().notNull(),
	noteId: int("note_id").notNull(),
	label: varchar({ length: 255 }),
	remindAt: timestamp("remind_at", { mode: 'string' }).notNull(),
	isSent: tinyint("is_sent").default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const notes = mysqlTable("notes", {
	id: int().autoincrement().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text(),
	projectId: int("project_id"),
	status: mysqlEnum(['offen','erledigt']).default('offen').notNull(),
	priority: mysqlEnum(['niedrig','normal','hoch']).default('normal').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const projectItems = mysqlTable("project_items", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id").notNull(),
	name: varchar({ length: 512 }).notNull(),
	quantity: int().default(1).notNull(),
	material: varchar({ length: 255 }),
	technique: mysqlEnum(['3d_print','cnc','painting','cad_work','model_making','assembly','other']).default('other'),
	productionType: mysqlEnum("production_type", ['in_house','external']).default('external').notNull(),
	unitEk: decimal("unit_ek", { precision: 12, scale: 2 }).default('0'),
	unitVk: decimal("unit_vk", { precision: 12, scale: 2 }).default('0'),
	marginPercent: decimal("margin_percent", { precision: 6, scale: 2 }).default('0'),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	totalEk: decimal("total_ek", { precision: 12, scale: 2 }).default('0'),
	totalVk: decimal("total_vk", { precision: 12, scale: 2 }).default('0'),
	description: text(),
	sortOrder: int("sort_order").default(0),
});

export const projects = mysqlTable("projects", {
	id: int().autoincrement().notNull(),
	projectNumber: varchar("project_number", { length: 64 }),
	title: varchar({ length: 512 }).notNull(),
	type: mysqlEnum(['serial_part','spare_part','museum','consulting','cad_work','other']).default('other').notNull(),
	status: mysqlEnum(['inquiry','calculation','offer','order','production','shipping','completed','cancelled']).default('inquiry').notNull(),
	customerId: int("customer_id"),
	leadSourceId: int("lead_source_id"),
	driveFolderUrl: varchar("drive_folder_url", { length: 1024 }),
	notes: text(),
	internalNotes: text("internal_notes"),
	deadline: timestamp({ mode: 'string' }),
	totalEk: decimal("total_ek", { precision: 12, scale: 2 }).default('0'),
	totalVk: decimal("total_vk", { precision: 12, scale: 2 }).default('0'),
	totalMargin: decimal("total_margin", { precision: 12, scale: 2 }).default('0'),
	marginPercent: decimal("margin_percent", { precision: 6, scale: 2 }).default('0'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const quickNotes = mysqlTable("quick_notes", {
	id: int().autoincrement().notNull(),
	text: text().notNull(),
	projectId: int("project_id").references(() => projects.id, { onDelete: "set null" } ),
	source: mysqlEnum(['whatsapp','telefon','persoenlich','email','sonstiges']).default('sonstiges'),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const rfqResponses = mysqlTable("rfq_responses", {
	id: int().autoincrement().notNull(),
	rfqId: int("rfq_id").notNull(),
	supplierId: int("supplier_id").notNull(),
	price: decimal({ precision: 12, scale: 2 }),
	deliveryDays: int("delivery_days"),
	notes: text(),
	isSelected: tinyint("is_selected").default(0).notNull(),
	receivedAt: timestamp("received_at", { mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
});

export const rfqs = mysqlTable("rfqs", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id").notNull(),
	projectItemId: int("project_item_id"),
	title: varchar({ length: 512 }).notNull(),
	description: text(),
	status: mysqlEnum(['draft','sent','responses_received','closed']).default('draft').notNull(),
	deadline: timestamp({ mode: 'string' }),
	supplierIds: json("supplier_ids"),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const shipments = mysqlTable("shipments", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id").notNull(),
	carrier: varchar({ length: 128 }),
	trackingNumber: varchar("tracking_number", { length: 256 }),
	shippedAt: timestamp("shipped_at", { mode: 'string' }),
	estimatedDelivery: timestamp("estimated_delivery", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	company: varchar({ length: 255 }),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 64 }),
	capabilities: json(),
	rating: int().default(3),
	notes: text(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	address: text(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);

// ─── Type Aliases (Insert / Select) ─────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type InsertCustomer = typeof customers.$inferInsert;
export type InsertLeadSource = typeof leadSources.$inferInsert;
export type InsertProject = typeof projects.$inferInsert;
export type InsertProjectItem = typeof projectItems.$inferInsert;
export type InsertSupplier = typeof suppliers.$inferInsert;
export type InsertRfq = typeof rfqs.$inferInsert;
export type InsertRfqResponse = typeof rfqResponses.$inferInsert;
export type InsertShipment = typeof shipments.$inferInsert;
export type InsertCadFile = typeof cadFiles.$inferInsert;
export type InsertConsultationEntry = typeof consultationEntries.$inferInsert;
export type InsertMaterialEntry = typeof materialsLibrary.$inferInsert;
export type InsertKnowledgeEntry = typeof knowledgeEntries.$inferInsert;
export type InsertImageLibraryEntry = typeof imageLibrary.$inferInsert;
export type InsertAiSession = typeof aiSessions.$inferInsert;
export type InsertQuickNote = typeof quickNotes.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NoteAttachment = typeof noteAttachments.$inferSelect;
export type NoteReminder = typeof noteReminders.$inferSelect;
