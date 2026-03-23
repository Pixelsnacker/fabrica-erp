ALTER TABLE `projects` MODIFY COLUMN `status` enum('inquiry','calculation','offer','order','production','shipping','completed','cancelled','rejected') NOT NULL DEFAULT 'inquiry';--> statement-breakpoint
ALTER TABLE `projects` ADD `archived_at` timestamp;--> statement-breakpoint
ALTER TABLE `projects` ADD `rejection_reason` enum('preis','timing','wettbewerber','kein_feedback','sonstiges');--> statement-breakpoint
ALTER TABLE `projects` ADD `rejection_note` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `reactivated_at` timestamp;