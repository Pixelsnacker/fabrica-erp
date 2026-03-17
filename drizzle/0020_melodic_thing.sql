CREATE TABLE `customer_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`project_id` int,
	`category` enum('cad_data','drawing','photo','nda','protocol','supplier_quote','contract','invoice','other') NOT NULL DEFAULT 'other',
	`filename` varchar(512) NOT NULL,
	`drive_file_id` varchar(255) NOT NULL,
	`drive_file_url` text NOT NULL,
	`file_size` bigint,
	`mime_type` varchar(128),
	`notes` text,
	`uploaded_by` varchar(255),
	`created_at` bigint NOT NULL
);
