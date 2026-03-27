CREATE TABLE `chat_delete_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`deleted_by` varchar(255) NOT NULL,
	`deleted_at` bigint NOT NULL,
	`message_count` int NOT NULL DEFAULT 0,
	`attachment_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `chat_delete_log_id` PRIMARY KEY(`id`)
);
