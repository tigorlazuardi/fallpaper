ALTER TABLE `images` ADD `source_item_id` text;--> statement-breakpoint
ALTER TABLE `images` ADD `gallery_index` integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX `images_source_item_id_idx` ON `images` (`source_item_id`);