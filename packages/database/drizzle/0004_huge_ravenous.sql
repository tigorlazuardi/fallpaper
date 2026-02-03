CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`website_url` text NOT NULL,
	`download_url` text NOT NULL,
	`checksum` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`aspect_ratio` real NOT NULL,
	`filesize` integer NOT NULL,
	`format` text NOT NULL,
	`title` text,
	`nsfw` integer DEFAULT 0 NOT NULL,
	`author` text,
	`author_url` text,
	`thumbnail_path` text,
	`source_created_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_download_url_unique` ON `images` (`download_url`);--> statement-breakpoint
CREATE INDEX `images_source_id_idx` ON `images` (`source_id`);--> statement-breakpoint
CREATE INDEX `images_checksum_idx` ON `images` (`checksum`);--> statement-breakpoint
CREATE INDEX `images_aspect_ratio_idx` ON `images` (`aspect_ratio`);--> statement-breakpoint
CREATE INDEX `images_nsfw_idx` ON `images` (`nsfw`);--> statement-breakpoint
CREATE TABLE `device_images` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`image_id` text,
	`local_path` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `device_images_device_id_idx` ON `device_images` (`device_id`);--> statement-breakpoint
CREATE INDEX `device_images_image_id_idx` ON `device_images` (`image_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_images_device_image_unique` ON `device_images` (`device_id`,`image_id`);