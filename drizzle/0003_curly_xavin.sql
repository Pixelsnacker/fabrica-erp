CREATE TABLE `company_settings` (
	`id` int NOT NULL DEFAULT 1,
	`name` varchar(255),
	`legal_form` varchar(100),
	`street` varchar(255),
	`zip` varchar(20),
	`city` varchar(100),
	`country` varchar(100) DEFAULT 'Deutschland',
	`phone` varchar(50),
	`email` varchar(255),
	`website` varchar(255),
	`tax_number` varchar(100),
	`vat_id` varchar(100),
	`iban` varchar(50),
	`bic` varchar(20),
	`bank_name` varchar(255),
	`logo_url` text,
	`logo_key` text,
	`invoice_footer` text,
	`kleinunternehmer` tinyint DEFAULT 0,
	`offer_prefix` varchar(20) DEFAULT 'AN',
	`invoice_prefix` varchar(20) DEFAULT 'RE',
	`credit_note_prefix` varchar(20) DEFAULT 'GS',
	`number_separator` varchar(5) DEFAULT '-',
	`number_padding` int DEFAULT 4,
	`include_year` tinyint DEFAULT 1,
	`offer_start_number` int DEFAULT 1,
	`invoice_start_number` int DEFAULT 1,
	`credit_note_start_number` int DEFAULT 1,
	`created_at` bigint,
	`updated_at` bigint,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complaint_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaint_id` int NOT NULL,
	`file_url` text NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`file_type` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`reported_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`resolved_at` timestamp,
	`resolution` text,
	`created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `invoice_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`action` enum('created','updated','status_changed','locked','cancelled','pdf_generated') NOT NULL,
	`changed_by` varchar(255),
	`changed_at` bigint NOT NULL,
	`field_changed` varchar(100),
	`old_value` text,
	`new_value` text,
	`snapshot_json` text,
	CONSTRAINT `invoice_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 1,
	`description` text NOT NULL,
	`quantity` decimal(10,3) DEFAULT '1.000',
	`unit` varchar(20) DEFAULT 'Stk.',
	`unit_price_net` decimal(12,2) NOT NULL DEFAULT '0.00',
	`tax_rate` decimal(5,2) DEFAULT '19.00',
	`line_total_net` decimal(12,2) DEFAULT '0.00',
	`line_tax` decimal(12,2) DEFAULT '0.00',
	`line_total_gross` decimal(12,2) DEFAULT '0.00',
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`type` enum('invoice','offer','credit_note') NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `invoice_sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_number` varchar(32) NOT NULL,
	`type` enum('offer','invoice','credit_note') NOT NULL DEFAULT 'offer',
	`status` enum('draft','sent','accepted','invoiced','paid','cancelled','overdue') NOT NULL DEFAULT 'draft',
	`customer_id` int,
	`project_id` int,
	`sender_name` varchar(255),
	`sender_street` varchar(255),
	`sender_zip` varchar(20),
	`sender_city` varchar(100),
	`sender_tax_id` varchar(50),
	`sender_vat_id` varchar(50),
	`sender_email` varchar(255),
	`sender_phone` varchar(50),
	`sender_iban` varchar(50),
	`sender_bic` varchar(20),
	`recipient_name` varchar(255),
	`recipient_company` varchar(255),
	`recipient_street` varchar(255),
	`recipient_zip` varchar(20),
	`recipient_city` varchar(100),
	`recipient_email` varchar(255),
	`issue_date` varchar(20),
	`due_date` varchar(20),
	`delivery_date` varchar(20),
	`payment_terms` varchar(255) DEFAULT 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
	`taxMode` enum('standard','reduced','mixed','tax_free','kleinunternehmer') DEFAULT 'standard',
	`subtotal_net` decimal(12,2) DEFAULT '0.00',
	`tax_amount` decimal(12,2) DEFAULT '0.00',
	`total_gross` decimal(12,2) DEFAULT '0.00',
	`currency` varchar(3) DEFAULT 'EUR',
	`intro_text` text,
	`notes` text,
	`footer_text` text,
	`pdf_url` varchar(1024),
	`pdf_key` varchar(512),
	`content_hash` varchar(64),
	`is_locked` tinyint DEFAULT 0,
	`cancelled_by` int,
	`cancels_invoice` int,
	`created_at` bigint,
	`updated_at` bigint,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `ai_sessions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `cad_files` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultation_entries` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `customers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `image_library` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `knowledge_entries` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `lead_sources` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `materials_library` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `note_attachments` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `note_reminders` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `notes` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `project_items` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `projects` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `quick_notes` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `rfq_responses` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `rfqs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `shipments` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `suppliers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ai_sessions` MODIFY COLUMN `sent_as_email` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_sessions` MODIFY COLUMN `sent_as_email` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ai_sessions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `cad_files` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultation_entries` MODIFY COLUMN `title` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `consultation_entries` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `is_active` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `image_library` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `knowledge_entries` MODIFY COLUMN `is_active` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `knowledge_entries` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `lead_sources` MODIFY COLUMN `type` enum('website','google_ads','referral','direct','social','other') NOT NULL DEFAULT 'website';--> statement-breakpoint
ALTER TABLE `lead_sources` MODIFY COLUMN `monthly_cost` decimal(10,2);--> statement-breakpoint
ALTER TABLE `lead_sources` MODIFY COLUMN `is_active` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `lead_sources` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `materials_library` MODIFY COLUMN `category` enum('plastic','metal','composite','surface_treatment','process','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `materials_library` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `note_attachments` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `note_reminders` MODIFY COLUMN `is_sent` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `note_reminders` MODIFY COLUMN `is_sent` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `note_reminders` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `notes` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `name` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `unit_ek` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `unit_vk` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `total_ek` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `total_vk` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `margin_percent` decimal(6,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `project_items` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `title` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `drive_folder_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `total_ek` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `total_vk` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `total_margin` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `margin_percent` decimal(6,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `quick_notes` MODIFY COLUMN `source` enum('whatsapp','telefon','persoenlich','email','sonstiges') DEFAULT 'sonstiges';--> statement-breakpoint
ALTER TABLE `rfq_responses` MODIFY COLUMN `price` decimal(12,2);--> statement-breakpoint
ALTER TABLE `rfq_responses` MODIFY COLUMN `is_selected` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `rfq_responses` MODIFY COLUMN `is_selected` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `rfq_responses` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `rfq_responses` MODIFY COLUMN `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `rfqs` MODIFY COLUMN `title` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `rfqs` MODIFY COLUMN `status` enum('draft','sent','responses_received','closed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `rfqs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `shipments` MODIFY COLUMN `tracking_number` varchar(256);--> statement-breakpoint
ALTER TABLE `shipments` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `is_active` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `customers` ADD `email2` varchar(320);--> statement-breakpoint
ALTER TABLE `customers` ADD `email3` varchar(320);--> statement-breakpoint
ALTER TABLE `customers` ADD `contact2` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `contact3` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `street` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `zip` varchar(20);--> statement-breakpoint
ALTER TABLE `customers` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `customers` ADD `country` varchar(100) DEFAULT 'Deutschland';--> statement-breakpoint
ALTER TABLE `project_items` ADD `supplier_offer_url` text;--> statement-breakpoint
ALTER TABLE `project_items` ADD `supplier_offer_key` varchar(512);--> statement-breakpoint
ALTER TABLE `project_items` ADD `supplier_offer_name` varchar(255);--> statement-breakpoint
ALTER TABLE `project_items` ADD `supplier_id` int;--> statement-breakpoint
ALTER TABLE `quick_notes` ADD `created_at` timestamp DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `suppliers` ADD `email2` varchar(320);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `email3` varchar(320);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `contact2` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `contact3` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `street` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `zip` varchar(20);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `country` varchar(100) DEFAULT 'Deutschland';--> statement-breakpoint
ALTER TABLE `quick_notes` ADD CONSTRAINT `quick_notes_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
ALTER TABLE `quick_notes` DROP COLUMN `createdAt`;