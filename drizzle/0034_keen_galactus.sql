CREATE TABLE `chat_delete_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`deleted_by` varchar(255) NOT NULL,
	`deleted_at` bigint NOT NULL,
	`message_count` int NOT NULL DEFAULT 0,
	`attachment_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `chat_delete_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	`chat_closed` tinyint NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_todos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`text` text NOT NULL,
	`created_by` varchar(255) NOT NULL,
	`created_by_type` enum('erp','customer') NOT NULL DEFAULT 'erp',
	`assigned_to` varchar(255),
	`assigned_to_type` enum('erp','customer'),
	`status` enum('open','done') NOT NULL DEFAULT 'open',
	`created_at` bigint NOT NULL,
	`done_at` bigint,
	`done_by` varchar(255),
	`handover_comment` text
);
--> statement-breakpoint
CREATE TABLE `supplier_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`category` enum('nda','contract','supplier_offer','invoice','delivery_note','drawing','cad_data','photo','protocol','other') NOT NULL DEFAULT 'other',
	`filename` varchar(512) NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`file_url` text NOT NULL,
	`file_size` int,
	`mime_type` varchar(128),
	`notes` text,
	`uploaded_by` varchar(255),
	`drive_file_id` varchar(255),
	`drive_synced` tinyint NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`expires_at` bigint,
	CONSTRAINT `supplier_documents_id` PRIMARY KEY(`id`)
);
