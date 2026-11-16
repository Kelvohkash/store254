CREATE TABLE IF NOT EXISTS `copyright_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`store_subdomain` text,
	`item_id` text,
	`item_title` text,
	`reported_image_url` text NOT NULL,
	`target_type` text DEFAULT 'ITEM_IMAGE' NOT NULL,
	`page_url` text,
	`reporter_name` text NOT NULL,
	`reporter_email` text NOT NULL,
	`original_work_url` text,
	`reason` text NOT NULL,
	`good_faith_confirmed` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolution_notes` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `copyright_reports_status_created_idx` ON `copyright_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `copyright_reports_tenant_idx` ON `copyright_reports` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `copyright_reports_item_idx` ON `copyright_reports` (`item_id`);
