CREATE TABLE `password_reset_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`tenant_id` text,
	`otp_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`expires_at` integer NOT NULL,
	`is_used` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `otp_email_used_expiry_idx` ON `password_reset_otps` (`email`,`is_used`,`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subdomain` text NOT NULL,
	`custom_domain` text,
	`business_type` text DEFAULT 'RETAIL' NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`settings` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tenants`("id", "name", "subdomain", "custom_domain", "business_type", "currency", "status", "settings", "created_at", "updated_at") SELECT "id", "name", "subdomain", "custom_domain", "business_type", "currency", "status", "settings", "created_at", "updated_at" FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_subdomain_unique` ON `tenants` (`subdomain`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE INDEX `tenants_subdomain_idx` ON `tenants` (`subdomain`);--> statement-breakpoint
CREATE INDEX `tenants_custom_domain_idx` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);