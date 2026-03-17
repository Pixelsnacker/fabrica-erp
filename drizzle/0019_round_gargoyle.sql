CREATE TABLE `inquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inquiry_number` varchar(64) NOT NULL,
	`supplier_id` int,
	`supplier_name` varchar(255),
	`supplier_contact` varchar(255),
	`supplier_email` varchar(320),
	`project_id` int,
	`status` enum('draft','sent','answered','completed','cancelled') NOT NULL DEFAULT 'draft',
	`subject` varchar(512),
	`intro_text` text,
	`outro_text` text,
	`desired_delivery_date` varchar(64),
	`payment_terms` varchar(255),
	`delivery_terms` varchar(255),
	`notes` text,
	`sent_at` timestamp,
	`answered_at` timestamp,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inquiry_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inquiry_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 1,
	`article_id` int,
	`description` varchar(512) NOT NULL,
	`long_description` text,
	`quantity` decimal(12,3) NOT NULL DEFAULT '1.000',
	`unit` varchar(32) NOT NULL DEFAULT 'Stk.',
	`remark` text,
	`created_at` bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE `company_settings` ADD `inquiry_prefix` varchar(20) DEFAULT 'ANF';--> statement-breakpoint
ALTER TABLE `company_settings` ADD `inquiry_start_number` int DEFAULT 1;