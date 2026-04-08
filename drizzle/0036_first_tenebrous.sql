ALTER TABLE `company_settings` ADD `overdue_reminder_enabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `overdue_reminder_email` varchar(255);--> statement-breakpoint
ALTER TABLE `invoices` ADD `overdue_reminder_sent` tinyint DEFAULT 0;