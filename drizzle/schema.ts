import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, text, json, timestamp, varchar, mysqlEnum, decimal, foreignKey, index, tinyint, boolean, bigint } from "drizzle-orm/mysql-core"
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
	email2: varchar({ length: 320 }),
	email3: varchar({ length: 320 }),
	phone: varchar({ length: 64 }),
	contact2: varchar({ length: 255 }),
	contact3: varchar({ length: 255 }),
	street: varchar({ length: 255 }),
	zip: varchar({ length: 20 }),
	city: varchar({ length: 100 }),
	country: varchar({ length: 100 }).default('Deutschland'),
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
	source: mysqlEnum(['whatsapp','telefon','email','persoenlich','sonstiges']).default('sonstiges'),
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
	supplierOfferUrl: text("supplier_offer_url"),
	supplierOfferKey: varchar("supplier_offer_key", { length: 512 }),
	supplierOfferName: varchar("supplier_offer_name", { length: 255 }),
	supplierId: int("supplier_id"),
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
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
	remindAt: timestamp("remind_at", { mode: 'string' }),
	remindLabel: varchar("remind_label", { length: 255 }),
	remindSent: tinyint("remind_sent").default(0),
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
	email2: varchar({ length: 320 }),
	email3: varchar({ length: 320 }),
	phone: varchar({ length: 64 }),
	contact2: varchar({ length: 255 }),
	contact3: varchar({ length: 255 }),
	street: varchar({ length: 255 }),
	zip: varchar({ length: 20 }),
	city: varchar({ length: 100 }),
	country: varchar({ length: 100 }).default('Deutschland'),
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

export const complaints = mysqlTable("complaints", {
	id: int().autoincrement().notNull(),
	projectId: int("project_id").notNull(),
	title: varchar({ length: 512 }).notNull(),
	description: text(),
	status: mysqlEnum(['open','in_progress','resolved','closed']).default('open').notNull(),
	priority: mysqlEnum(['low','normal','high','critical']).default('normal').notNull(),
	reportedAt: timestamp("reported_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	resolution: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const complaintAttachments = mysqlTable("complaint_attachments", {
	id: int().autoincrement().notNull(),
	complaintId: int("complaint_id").notNull(),
	fileUrl: text("file_url").notNull(),
	fileKey: varchar("file_key", { length: 512 }).notNull(),
	filename: varchar({ length: 255 }).notNull(),
	fileType: varchar("file_type", { length: 64 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export type InsertComplaint = typeof complaints.$inferInsert;
export type InsertComplaintAttachment = typeof complaintAttachments.$inferInsert;

// ─── Invoice Module (GoBD-konform, §14 UStG) ─────────────────────────────────
export const invoiceSequences = mysqlTable("invoice_sequences", {
  id: int().autoincrement().primaryKey(),
  year: int().notNull(),
   type: mysqlEnum(['invoice','offer','credit_note','order_confirmation','purchase_order']).notNull(),
  lastNumber: int("last_number").notNull().default(0),
});
export const invoices = mysqlTable("invoices", {
  id: int().autoincrement().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 32 }).notNull(),
  type: mysqlEnum(['offer','invoice','credit_note','order_confirmation','purchase_order']).notNull().default('offer'),
  status: mysqlEnum(['draft','sent','accepted','invoiced','paid','cancelled','overdue']).notNull().default('draft'),
  customerId: int("customer_id"),
  projectId: int("project_id"),
  // Absender-Snapshot
  senderName: varchar("sender_name", { length: 255 }),
  senderStreet: varchar("sender_street", { length: 255 }),
  senderZip: varchar("sender_zip", { length: 20 }),
  senderCity: varchar("sender_city", { length: 100 }),
  senderTaxId: varchar("sender_tax_id", { length: 50 }),
  senderVatId: varchar("sender_vat_id", { length: 50 }),
  senderEmail: varchar("sender_email", { length: 255 }),
  senderPhone: varchar("sender_phone", { length: 50 }),
  senderIban: varchar("sender_iban", { length: 50 }),
  senderBic: varchar("sender_bic", { length: 20 }),
  // Empfänger-Snapshot
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientCompany: varchar("recipient_company", { length: 255 }),
  recipientStreet: varchar("recipient_street", { length: 255 }),
  recipientZip: varchar("recipient_zip", { length: 20 }),
  recipientCity: varchar("recipient_city", { length: 100 }),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  // Daten
  issueDate: varchar("issue_date", { length: 20 }),
  dueDate: varchar("due_date", { length: 20 }),
  deliveryDate: varchar("delivery_date", { length: 20 }),
  paymentTerms: varchar("payment_terms", { length: 255 }).default('Zahlbar innerhalb von 14 Tagen ohne Abzug.'),
  // Steuer
  taxMode: mysqlEnum("tax_mode", ['standard','reduced','mixed','tax_free','kleinunternehmer']).default('standard'),
  // Beträge
  subtotalNet: decimal("subtotal_net", { precision: 12, scale: 2 }).default('0.00'),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default('0.00'),
  totalGross: decimal("total_gross", { precision: 12, scale: 2 }).default('0.00'),
  currency: varchar({ length: 3 }).default('EUR'),
  // Texte
  introText: text("intro_text"),
  notes: text(),
  footerText: text("footer_text"),
  // GoBD
  pdfUrl: varchar("pdf_url", { length: 1024 }),
  pdfKey: varchar("pdf_key", { length: 512 }),
  contentHash: varchar("content_hash", { length: 64 }),
  isLocked: tinyint("is_locked").default(0),
  cancelledBy: int("cancelled_by"),
  cancelsInvoice: int("cancels_invoice"),
  createdAt: bigint("created_at", { mode: "number" }),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const invoiceItems = mysqlTable("invoice_items", {
  id: int().autoincrement().primaryKey(),
  invoiceId: int("invoice_id").notNull(),
  position: int().notNull().default(1),
  description: text().notNull(),
  quantity: decimal({ precision: 10, scale: 3 }).default('1.000'),
  unit: varchar({ length: 20 }).default('Stk.'),
  unitPriceNet: decimal("unit_price_net", { precision: 12, scale: 2 }).notNull().default('0.00'),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('19.00'),
  lineTotalNet: decimal("line_total_net", { precision: 12, scale: 2 }).default('0.00'),
  lineTax: decimal("line_tax", { precision: 12, scale: 2 }).default('0.00'),
  lineTotalGross: decimal("line_total_gross", { precision: 12, scale: 2 }).default('0.00'),
  longDescription: text("long_description"),
  isOptional: tinyint("is_optional").default(0),
  discount: decimal({ precision: 5, scale: 2 }).default('0.00'),
  discountedNet: decimal("discounted_net", { precision: 12, scale: 2 }).default('0.00'),
});

export const invoiceAuditLog = mysqlTable("invoice_audit_log", {
  id: int().autoincrement().primaryKey(),
  invoiceId: int("invoice_id").notNull(),
  action: mysqlEnum(['created','updated','status_changed','locked','cancelled','pdf_generated']).notNull(),
  changedBy: varchar("changed_by", { length: 255 }),
  changedAt: bigint("changed_at", { mode: "number" }).notNull(),
  fieldChanged: varchar("field_changed", { length: 100 }),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  snapshotJson: text("snapshot_json"),
});

export type InsertInvoice = typeof invoices.$inferInsert;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;
export type InsertInvoiceAuditLog = typeof invoiceAuditLog.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// ─── Company Settings ─────────────────────────────────────────────────────────
export const companySettings = mysqlTable("company_settings", {
  id: int("id").primaryKey().default(1),
  name: varchar("name", { length: 255 }),
  legalForm: varchar("legal_form", { length: 100 }),
  street: varchar("street", { length: 255 }),
  zip: varchar("zip", { length: 20 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Deutschland"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  taxNumber: varchar("tax_number", { length: 100 }),
  vatId: varchar("vat_id", { length: 100 }),
  iban: varchar("iban", { length: 50 }),
  bic: varchar("bic", { length: 20 }),
  bankName: varchar("bank_name", { length: 255 }),
  logoUrl: text("logo_url"),
  logoKey: text("logo_key"),
  invoiceFooter: text("invoice_footer"),
  // 4-spaltige Fußzeile (Adresse | Kontakt | Rechtliches | Bank)
  footerCol1: text("footer_col1"), // Spalte 1: Firmenadresse
  footerCol2: text("footer_col2"), // Spalte 2: Tel/Fax/Email/Web
  footerCol3: text("footer_col3"), // Spalte 3: Amtsgericht/HR/USt/Steuer/GF
  footerCol4: text("footer_col4"), // Spalte 4: Bank/IBAN/BIC
  kleinunternehmer: tinyint("kleinunternehmer").default(0),
  // Nummernkreis-Konfiguration
  offerPrefix: varchar("offer_prefix", { length: 20 }).default("AN"),
  invoicePrefix: varchar("invoice_prefix", { length: 20 }).default("RE"),
  creditNotePrefix: varchar("credit_note_prefix", { length: 20 }).default("GS"),
  numberSeparator: varchar("number_separator", { length: 5 }).default("-"),
  numberPadding: int("number_padding").default(4),
  includeYear: tinyint("include_year").default(1),
  offerStartNumber: int("offer_start_number").default(1),
  invoiceStartNumber: int("invoice_start_number").default(1),
  creditNoteStartNumber: int("credit_note_start_number").default(1),
  agbText: text("agb_text"),
  // SMTP-Konfiguration für E-Mail-Versand
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: int("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: varchar("smtp_pass", { length: 500 }),
  smtpFrom: varchar("smtp_from", { length: 255 }),
  smtpSecure: tinyint("smtp_secure").default(0),
  emailSignature: text("email_signature"),
  createdAt: bigint("created_at", { mode: "number" }),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export type InsertCompanySettings = typeof companySettings.$inferInsert;
export type CompanySettings = typeof companySettings.$inferSelect;

// ─── Kalender ─────────────────────────────────────────────────────────────────
export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startAt: bigint("start_at", { mode: "number" }).notNull(),
  endAt: bigint("end_at", { mode: "number" }).notNull(),
  allDay: tinyint("all_day").default(0),
  category: mysqlEnum("category", ["customer", "project", "invoice", "personal", "other"]).default("other"),
  color: varchar("color", { length: 20 }).default("#6366f1"),
  location: varchar("location", { length: 255 }),
  googleEventId: varchar("google_event_id", { length: 255 }),
  customerId: int("customer_id"),
  projectId: int("project_id"),
  createdBy: int("created_by"),
  createdAt: bigint("created_at", { mode: "number" }),
  updatedAt: bigint("updated_at", { mode: "number" }),
  reminder1Min: int("reminder1_min"),
  reminder2Min: int("reminder2_min"),
  reminder3Min: int("reminder3_min"),
  reminderSent: tinyint("reminder_sent").default(0),
});

export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// ─── Projekt-Dokumente ────────────────────────────────────────────────────────
export const projectDocuments = mysqlTable("project_documents", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  supplierId: int("supplier_id"),
  category: mysqlEnum("category", [
    "supplier_offer",   // Lieferantenangebot
    "nda",              // Geheimhaltungserklärung
    "order",            // Bestellung
    "delivery_note",    // Lieferschein
    "invoice",          // Eingangsrechnung
    "contract",         // Vertrag
    "drawing",          // Zeichnung / Technische Unterlagen
    "cad_data",         // CAD Daten
    "other",            // Sonstiges
  ]).default("other").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: int("file_size"),
  mimeType: varchar("mime_type", { length: 128 }),
  notes: text("notes"),
  uploadedBy: varchar("uploaded_by", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type InsertProjectDocument = typeof projectDocuments.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;

// ── Artikeldatenbank ──────────────────────────────────────────────────────────
export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().notNull(),
  articleNumber: varchar("article_number", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  unit: varchar("unit", { length: 32 }).default("Stk.").notNull(),
  unitPriceNet: decimal("unit_price_net", { precision: 12, scale: 2 }).default("0.00").notNull(),
  taxRate: int("tax_rate").default(19).notNull(),
  category: varchar("category", { length: 128 }),
  isActive: tinyint("is_active").default(1).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type InsertArticle = typeof articles.$inferInsert;
export type Article = typeof articles.$inferSelect;
