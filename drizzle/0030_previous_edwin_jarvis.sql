CREATE TABLE `project_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`sender_type` enum('erp','customer') NOT NULL,
	`sender_name` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`attachment_url` text,
	`attachment_key` varchar(512),
	`attachment_name` varchar(512),
	`attachment_mime` varchar(128),
	`attachment_size` bigint,
	`mention_triggered` tinyint DEFAULT 0,
	`created_at` bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_portal_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`drive_backup_done` tinyint DEFAULT 0,
	`drive_backup_error` text,
	`invitation_sent_at` bigint,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL
);
