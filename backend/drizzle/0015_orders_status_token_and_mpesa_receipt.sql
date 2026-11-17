ALTER TABLE `orders` ADD `status_token_hash` text;--> statement-breakpoint
UPDATE `orders` SET `inventory_deducted` = 1 WHERE `inventory_deducted` = 0 AND json_extract(`fulfillment_details`, '$.inventoryDeducted') = 1;--> statement-breakpoint
DROP INDEX IF EXISTS `payments_mpesa_receipt_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `payments_mpesa_receipt_unique_idx` ON `payments` (`mpesa_receipt_number`) WHERE `mpesa_receipt_number` IS NOT NULL;
