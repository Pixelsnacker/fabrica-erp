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
