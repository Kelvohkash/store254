CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`is_verified_buyer` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reviews_tenant_item_rating_idx` ON `reviews` (`tenant_id`,`item_id`,`rating`);--> statement-breakpoint
CREATE INDEX `reviews_tenant_customer_idx` ON `reviews` (`tenant_id`,`customer_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_details` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `orders` ADD `booking_details` text DEFAULT '{}';