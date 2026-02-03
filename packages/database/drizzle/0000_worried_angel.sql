-- Must be set before creating tables
PRAGMA page_size = 4096;
--> statement-breakpoint
PRAGMA auto_vacuum = INCREMENTAL;
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`height` integer NOT NULL,
	`width` integer NOT NULL,
	`aspect_ratio_delta` real DEFAULT 0.2 NOT NULL,
	`min_height` integer,
	`max_height` integer,
	`min_width` integer,
	`max_width` integer,
	`min_filesize` integer,
	`max_filesize` integer,
	`nsfw` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_slug_unique` ON `devices` (`slug`);