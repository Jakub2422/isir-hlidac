CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`spis` text NOT NULL,
	`published_at` text NOT NULL,
	`description` text NOT NULL,
	`document_url` text NOT NULL,
	`verdict` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`event_id` integer PRIMARY KEY NOT NULL,
	`spis` text NOT NULL,
	`published_at` text NOT NULL,
	`detected_at` text NOT NULL,
	`district` text NOT NULL,
	`city` text NOT NULL,
	`kind` text NOT NULL,
	`lv` text DEFAULT '' NOT NULL,
	`parcel` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`document_url` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `findings_detected_idx` ON `findings` (`detected_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
