CREATE TABLE `subscriptions` (
	`device_id` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`device_id`, `source_id`),
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscriptions_source_id_idx` ON `subscriptions` (`source_id`);