ALTER TABLE `cad_files` ADD `drive_file_id` varchar(255);--> statement-breakpoint
ALTER TABLE `cad_files` ADD `drive_synced` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_documents` ADD `drive_file_id` varchar(255);--> statement-breakpoint
ALTER TABLE `project_documents` ADD `drive_synced` tinyint DEFAULT 0 NOT NULL;