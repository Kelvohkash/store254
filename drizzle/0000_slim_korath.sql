CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subdomain` text NOT NULL,
	`custom_domain` text,
	`business_type` text DEFAULT 'RETAIL' NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`settings` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_subdomain_unique` ON `tenants` (`subdomain`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE INDEX `tenants_subdomain_idx` ON `tenants` (`subdomain`);--> statement-breakpoint
CREATE INDEX `tenants_custom_domain_idx` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text,
	`phone` text,
	`role` text DEFAULT 'CUSTOMER' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_email_idx` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_tenant_role_idx` ON `users` (`tenant_id`,`role`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_tenant_slug_idx` ON `categories` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `categories_tenant_parent_idx` ON `categories` (`tenant_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `attribute_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`category_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'TEXT' NOT NULL,
	`options` text DEFAULT '[]',
	`unit` text,
	`is_filterable` integer DEFAULT true NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attr_def_tenant_category_code_idx` ON `attribute_definitions` (`tenant_id`,`category_id`,`code`);--> statement-breakpoint
CREATE INDEX `attr_def_tenant_filterable_idx` ON `attribute_definitions` (`tenant_id`,`is_filterable`);--> statement-breakpoint
CREATE TABLE `item_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`title` text NOT NULL,
	`sku` text,
	`price` integer NOT NULL,
	`compare_at_price` integer,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`options` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_tenant_item_idx` ON `item_variants` (`tenant_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`item_type` text DEFAULT 'PHYSICAL' NOT NULL,
	`base_price` integer NOT NULL,
	`compare_at_price` integer,
	`cost_price` integer,
	`sku` text,
	`barcode` text,
	`track_inventory` integer DEFAULT true NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PUBLISHED' NOT NULL,
	`images` text DEFAULT '[]',
	`attributes` text DEFAULT '{}',
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_tenant_slug_idx` ON `items` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `items_tenant_category_idx` ON `items` (`tenant_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `items_tenant_status_idx` ON `items` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `items_tenant_price_idx` ON `items` (`tenant_id`,`base_price`);--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`code` text,
	`discount_type` text DEFAULT 'PERCENTAGE' NOT NULL,
	`discount_value` integer NOT NULL,
	`min_order_amount` integer DEFAULT 0 NOT NULL,
	`max_discount_amount` integer,
	`applies_to` text DEFAULT 'ALL' NOT NULL,
	`target_ids` text DEFAULT '[]',
	`usage_limit` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotions_tenant_code_idx` ON `promotions` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `promotions_tenant_active_idx` ON `promotions` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`ip_address` text,
	`details` text DEFAULT '{}',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_action_idx` ON `audit_logs` (`tenant_id`,`action`);