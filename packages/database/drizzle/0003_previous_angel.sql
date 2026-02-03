CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`cron` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_source_id_idx` ON `schedules` (`source_id`);