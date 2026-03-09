CREATE TABLE `quick_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`text` text NOT NULL,
	`project_id` int,
	`source` enum('whatsapp','telefon','persoenlich','email','sonstiges') NOT NULL DEFAULT 'sonstiges',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quick_notes_id` PRIMARY KEY(`id`)
);
