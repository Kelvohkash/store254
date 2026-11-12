CREATE TABLE `platform_billing_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` integer NOT NULL,
	`interval_days` integer NOT NULL,
	`phone_number` text NOT NULL,
	`status` text DEFAULT 'INITIATED' NOT NULL,
	`merchant_request_id` text,
	`checkout_request_id` text,
	`callback_token_hash` text NOT NULL,
	`mpesa_receipt_number` text,
	`result_code` integer,
	`result_desc` text,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_billing_payments_checkout_request_id_unique` ON `platform_billing_payments` (`checkout_request_id`);--> statement-breakpoint
CREATE INDEX `platform_billing_tenant_created_idx` ON `platform_billing_payments` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `platform_billing_checkout_idx` ON `platform_billing_payments` (`checkout_request_id`);--> statement-breakpoint
CREATE TABLE `platform_billing_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`interval_days` integer DEFAULT 30 NOT NULL,
	`shortcode_type` text DEFAULT 'PAYBILL' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tenants` ADD `subscription_due_at` integer;