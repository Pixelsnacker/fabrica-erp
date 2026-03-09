CREATE TABLE `cad_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`project_item_id` int,
	`filename` varchar(512) NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`file_url` varchar(1024) NOT NULL,
	`file_size` int,
	`mime_type` varchar(128),
	`version` int NOT NULL DEFAULT 1,
	`version_note` text,
	`parent_file_id` int,
	`uploaded_by` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cad_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultation_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int,
	`customer_id` int,
	`type` enum('material_advice','process_advice','technical_analysis','offer_discussion','general','other') NOT NULL DEFAULT 'general',
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`tags` json DEFAULT ('[]'),
	`outcome` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultation_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255),
	`type` enum('b2b','museum','industry','private','other') NOT NULL DEFAULT 'b2b',
	`email` varchar(320),
	`phone` varchar(64),
	`address` text,
	`notes` text,
	`sevdesk_id` varchar(64),
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('website','google_ads','referral','direct','other') NOT NULL DEFAULT 'other',
	`monthly_cost` decimal(10,2) DEFAULT '0.00',
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materials_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('metal','plastic','composite','surface_treatment','process','other') NOT NULL DEFAULT 'other',
	`properties` text,
	`applications` text,
	`advantages` text,
	`disadvantages` text,
	`notes` text,
	`tags` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materials_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`quantity` int NOT NULL DEFAULT 1,
	`material` varchar(255),
	`technique` enum('3d_print','cnc','painting','cad_work','model_making','assembly','other') DEFAULT 'other',
	`production_type` enum('in_house','external') NOT NULL DEFAULT 'external',
	`unit_ek` decimal(10,2) DEFAULT '0.00',
	`unit_vk` decimal(10,2) DEFAULT '0.00',
	`total_ek` decimal(10,2) DEFAULT '0.00',
	`total_vk` decimal(10,2) DEFAULT '0.00',
	`margin_percent` decimal(5,2) DEFAULT '0.00',
	`notes` text,
	`sort_order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`project_number` varchar(64),
	`type` enum('serial_part','spare_part','museum','consulting','cad_work','other') NOT NULL DEFAULT 'other',
	`status` enum('inquiry','calculation','offer','order','production','shipping','completed','cancelled') NOT NULL DEFAULT 'inquiry',
	`customer_id` int,
	`lead_source_id` int,
	`drive_folder_url` varchar(512),
	`notes` text,
	`internal_notes` text,
	`deadline` timestamp,
	`total_ek` decimal(10,2) DEFAULT '0.00',
	`total_vk` decimal(10,2) DEFAULT '0.00',
	`total_margin` decimal(10,2) DEFAULT '0.00',
	`margin_percent` decimal(5,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfq_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rfq_id` int NOT NULL,
	`supplier_id` int NOT NULL,
	`price` decimal(10,2),
	`delivery_days` int,
	`notes` text,
	`is_selected` boolean NOT NULL DEFAULT false,
	`received_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rfq_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfqs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`project_item_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`deadline` timestamp,
	`status` enum('draft','sent','responses_received','completed') NOT NULL DEFAULT 'draft',
	`supplier_ids` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rfqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`carrier` varchar(128),
	`tracking_number` varchar(255),
	`shipped_at` timestamp,
	`estimated_delivery` timestamp,
	`delivered_at` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255),
	`email` varchar(320),
	`phone` varchar(64),
	`address` text,
	`capabilities` json DEFAULT ('[]'),
	`rating` int DEFAULT 3,
	`is_active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
