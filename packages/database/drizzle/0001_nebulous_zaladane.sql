CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_name_unique` ON `sources` (`name`);--> statement-breakpoint
CREATE INDEX `sources_name_ci_idx` ON `sources` ("name" COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `sources_kind_idx` ON `sources` (`kind`);