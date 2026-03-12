ALTER TABLE `quick_notes` ADD `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `quick_notes` ADD `remind_at` timestamp;--> statement-breakpoint
ALTER TABLE `quick_notes` ADD `remind_label` varchar(255);--> statement-breakpoint
ALTER TABLE `quick_notes` ADD `remind_sent` tinyint DEFAULT 0;