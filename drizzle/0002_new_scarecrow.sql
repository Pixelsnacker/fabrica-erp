CREATE TABLE `note_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`note_id` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`file_url` text NOT NULL,
	`file_key` text NOT NULL,
	`file_type` enum('image','pdf','other') NOT NULL DEFAULT 'other',
	`file_size` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `note_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`note_id` int NOT NULL,
	`label` varchar(255),
	`remind_at` timestamp NOT NULL,
	`is_sent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `note_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`project_id` int,
	`status` enum('offen','erledigt') NOT NULL DEFAULT 'offen',
	`priority` enum('niedrig','normal','hoch') NOT NULL DEFAULT 'normal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
