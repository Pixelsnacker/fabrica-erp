ALTER TABLE `consultation_entries` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `materials_library` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `rfqs` MODIFY COLUMN `supplier_ids` json;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `capabilities` json;