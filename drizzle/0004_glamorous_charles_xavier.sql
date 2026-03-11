CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`start_at` bigint NOT NULL,
	`end_at` bigint NOT NULL,
	`all_day` tinyint DEFAULT 0,
	`category` enum('customer','project','invoice','personal','other') DEFAULT 'other',
	`color` varchar(20) DEFAULT '#6366f1',
	`location` varchar(255),
	`google_event_id` varchar(255),
	`customer_id` int,
	`project_id` int,
	`created_by` int,
	`created_at` bigint,
	`updated_at` bigint,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`category` enum('supplier_offer','nda','order','delivery_note','invoice','contract','drawing','other') NOT NULL DEFAULT 'other',
	`filename` varchar(512) NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`file_url` text NOT NULL,
	`file_size` int,
	`mime_type` varchar(128),
	`notes` text,
	`uploaded_by` varchar(255),
	`created_at` bigint NOT NULL,
	CONSTRAINT `project_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD `tax_mode` enum('standard','reduced','mixed','tax_free','kleinunternehmer') DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `taxMode`;