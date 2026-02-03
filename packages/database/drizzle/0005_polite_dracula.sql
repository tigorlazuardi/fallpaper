CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`schedule_id` text,
	`name` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`input` text DEFAULT '{}' NOT NULL,
	`output` text,
	`error` text,
	`progress_current` integer DEFAULT 0,
	`progress_total` integer DEFAULT 0,
	`progress_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`scheduled_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `runs_state_scheduled_idx` ON `runs` (`state`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `runs_name_idx` ON `runs` (`name`);--> statement-breakpoint
CREATE INDEX `runs_source_id_idx` ON `runs` (`source_id`);--> statement-breakpoint
CREATE INDEX `runs_schedule_id_idx` ON `runs` (`schedule_id`);