CREATE TABLE `kenya_constituencies` (
	`id` text PRIMARY KEY NOT NULL,
	`code` integer NOT NULL,
	`county_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`centroid_lat` real NOT NULL,
	`centroid_lng` real NOT NULL,
	FOREIGN KEY (`county_id`) REFERENCES `kenya_counties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kenya_constituencies_code_unique` ON `kenya_constituencies` (`code`);--> statement-breakpoint
CREATE INDEX `kenya_constituencies_county_idx` ON `kenya_constituencies` (`county_id`);--> statement-breakpoint
CREATE INDEX `kenya_constituencies_slug_idx` ON `kenya_constituencies` (`slug`);--> statement-breakpoint
CREATE TABLE `kenya_counties` (
	`id` text PRIMARY KEY NOT NULL,
	`code` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`centroid_lat` real NOT NULL,
	`centroid_lng` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kenya_counties_code_unique` ON `kenya_counties` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `kenya_counties_slug_unique` ON `kenya_counties` (`slug`);--> statement-breakpoint
CREATE INDEX `kenya_counties_name_idx` ON `kenya_counties` (`name`);--> statement-breakpoint
CREATE TABLE `kenya_location_neighbors` (
	`location_id` text NOT NULL,
	`neighbor_location_id` text NOT NULL,
	`distance_km` real NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`location_id`, `neighbor_location_id`),
	FOREIGN KEY (`location_id`) REFERENCES `kenya_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`neighbor_location_id`) REFERENCES `kenya_locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kenya_loc_neighbors_rank_idx` ON `kenya_location_neighbors` (`location_id`,`rank`);--> statement-breakpoint
CREATE TABLE `kenya_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`county_id` text NOT NULL,
	`constituency_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'TRADING_CENTRE' NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`source` text DEFAULT 'GEONAMES' NOT NULL,
	`google_place_id` text,
	`population` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`county_id`) REFERENCES `kenya_counties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`constituency_id`) REFERENCES `kenya_constituencies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kenya_locations_slug_unique` ON `kenya_locations` (`slug`);--> statement-breakpoint
CREATE INDEX `kenya_locations_county_idx` ON `kenya_locations` (`county_id`);--> statement-breakpoint
CREATE INDEX `kenya_locations_constituency_idx` ON `kenya_locations` (`constituency_id`);--> statement-breakpoint
CREATE INDEX `kenya_locations_name_idx` ON `kenya_locations` (`name`);--> statement-breakpoint
CREATE INDEX `kenya_locations_place_id_idx` ON `kenya_locations` (`google_place_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `county_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `constituency_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `location_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `location_label` text;--> statement-breakpoint
CREATE INDEX `tenants_location_idx` ON `tenants` (`county_id`,`constituency_id`,`location_id`);