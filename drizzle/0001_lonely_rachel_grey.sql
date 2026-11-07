CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`order_id` text NOT NULL,
	`item_id` text,
	`variant_id` text,
	`title` text NOT NULL,
	`sku` text,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`total_price` integer NOT NULL,
	`options` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_tenant_order_idx` ON `order_items` (`tenant_id`,`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`order_number` text NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`shipping_address` text DEFAULT '{}',
	`currency` text DEFAULT 'KES' NOT NULL,
	`subtotal` integer NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`shipping_fee` integer DEFAULT 0 NOT NULL,
	`total_amount` integer NOT NULL,
	`coupon_code` text,
	`status` text DEFAULT 'PENDING_PAYMENT' NOT NULL,
	`payment_status` text DEFAULT 'PENDING' NOT NULL,
	`payment_method` text DEFAULT 'MPESA' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_tenant_number_idx` ON `orders` (`tenant_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `orders_tenant_status_idx` ON `orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_tenant_customer_idx` ON `orders` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`order_id` text NOT NULL,
	`payment_method` text DEFAULT 'MPESA' NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`status` text DEFAULT 'INITIATED' NOT NULL,
	`merchant_request_id` text,
	`checkout_request_id` text,
	`mpesa_receipt_number` text,
	`transaction_date` integer,
	`phone_number` text,
	`result_code` integer,
	`result_desc` text,
	`raw_callback` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_checkout_request_id_unique` ON `payments` (`checkout_request_id`);--> statement-breakpoint
CREATE INDEX `payments_checkout_req_idx` ON `payments` (`checkout_request_id`);--> statement-breakpoint
CREATE INDEX `payments_mpesa_receipt_idx` ON `payments` (`mpesa_receipt_number`);--> statement-breakpoint
CREATE INDEX `payments_tenant_order_idx` ON `payments` (`tenant_id`,`order_id`);--> statement-breakpoint
CREATE TABLE `tenant_payment_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text DEFAULT 'MPESA' NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`shortcode_type` text DEFAULT 'PAYBILL' NOT NULL,
	`shortcode` text,
	`passkey` text,
	`consumer_key` text,
	`consumer_secret` text,
	`is_sandbox` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_payment_provider_idx` ON `tenant_payment_configs` (`tenant_id`,`provider`);