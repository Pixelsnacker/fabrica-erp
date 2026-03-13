ALTER TABLE `company_settings` ADD `agb_text` text;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `long_description` text;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `is_optional` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `discount` decimal(5,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `discounted_net` decimal(12,2) DEFAULT '0.00';