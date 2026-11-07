ALTER TABLE `users` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` text;--> statement-breakpoint
CREATE INDEX `users_tenant_google_id_idx` ON `users` (`tenant_id`,`google_id`);