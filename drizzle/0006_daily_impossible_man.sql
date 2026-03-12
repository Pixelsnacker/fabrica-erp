ALTER TABLE `calendar_events` ADD `reminder1_min` int;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `reminder2_min` int;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `reminder3_min` int;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `reminder_sent` tinyint DEFAULT 0;