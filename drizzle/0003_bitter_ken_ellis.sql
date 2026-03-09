CREATE TABLE `ai_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int,
	`customer_id` int,
	`prompt` text NOT NULL,
	`generated_text` text,
	`selected_image_ids` json,
	`used_knowledge_ids` json,
	`sent_as_email` boolean NOT NULL DEFAULT false,
	`sent_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` enum('material','surface_treatment','process','reference','product','other') NOT NULL DEFAULT 'other',
	`file_key` varchar(512) NOT NULL,
	`file_url` varchar(1024) NOT NULL,
	`tags` json,
	`use_count` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `image_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('material','surface_treatment','process','supplier_info','project_type','pricing','general') NOT NULL DEFAULT 'general',
	`content` text NOT NULL,
	`tags` json,
	`source` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`use_count` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_entries_id` PRIMARY KEY(`id`)
);
