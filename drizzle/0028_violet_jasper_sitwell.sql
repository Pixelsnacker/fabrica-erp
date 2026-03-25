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
	CONSTRAINT `supplier_documents_id` PRIMARY KEY(`id`)
);
