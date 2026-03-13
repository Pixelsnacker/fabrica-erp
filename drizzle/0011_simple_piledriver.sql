ALTER TABLE `company_settings` ADD `smtp_host` varchar(255);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `smtp_port` int DEFAULT 587;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `smtp_user` varchar(255);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `smtp_pass` varchar(500);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `smtp_from` varchar(255);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `smtp_secure` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `email_signature` text;