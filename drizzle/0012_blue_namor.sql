CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`article_number` varchar(64),
	`name` varchar(255) NOT NULL,
	`description` text,
	`long_description` text,
	`unit` varchar(32) NOT NULL DEFAULT 'Stk.',
	`unit_price_net` decimal(12,2) NOT NULL DEFAULT '0.00',
	`tax_rate` int NOT NULL DEFAULT 19,
	`category` varchar(128),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL
);
