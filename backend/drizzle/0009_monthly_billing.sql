ALTER TABLE `platform_billing_payments` RENAME COLUMN `interval_days` TO `interval_months`;
--> statement-breakpoint
CREATE TABLE `platform_billing_settings_monthly` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`interval_months` integer DEFAULT 1 NOT NULL,
	`shortcode_type` text DEFAULT 'PAYBILL' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `platform_billing_settings_monthly` (`id`, `amount`, `interval_months`, `shortcode_type`, `updated_at`)
SELECT `id`, `amount`, 1, `shortcode_type`, `updated_at` FROM `platform_billing_settings`;
--> statement-breakpoint
DROP TABLE `platform_billing_settings`;
--> statement-breakpoint
ALTER TABLE `platform_billing_settings_monthly` RENAME TO `platform_billing_settings`;
--> statement-breakpoint
UPDATE `platform_billing_payments` SET `interval_months` = 1;
--> statement-breakpoint
UPDATE `tenants` SET `subscription_due_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE `status` = 'ACTIVE' AND `subscription_due_at` IS NULL;
