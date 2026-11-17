ALTER TABLE `users` ADD `email_verified_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `token_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `users` SET `email_verified_at` = coalesce(`last_login_at`, `created_at`, unixepoch()) WHERE `email_verified_at` IS NULL AND (`role` IN ('OWNER', 'ADMIN') OR `google_id` IS NOT NULL OR (`role` = 'STAFF' AND lower(`email`) LIKE '%.store254.co.ke'));
