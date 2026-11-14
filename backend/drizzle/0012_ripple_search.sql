CREATE INDEX IF NOT EXISTS `kenya_locations_kind_pop_idx` ON `kenya_locations` (`kind`, `population` DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kenya_locations_coords_idx` ON `kenya_locations` (`latitude`, `longitude`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `items_status_created_idx` ON `items` (`status`, `created_at` DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `items_status_type_price_idx` ON `items` (`status`, `item_type`, `base_price`);--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `items_fts` USING fts5(
  `item_id` UNINDEXED,
  `tenant_id` UNINDEXED,
  `title`,
  `description`,
  `category_name`,
  `store_name`,
  `sku`,
  `attributes_text`,
  tokenize = 'porter unicode61 remove_diacritics 2',
  prefix = '2 3'
);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `items_fts_ai` AFTER INSERT ON `items` BEGIN
  INSERT INTO `items_fts` (`item_id`, `tenant_id`, `title`, `description`, `category_name`, `store_name`, `sku`, `attributes_text`)
  VALUES (
    new.id,
    new.tenant_id,
    coalesce(new.title, ''),
    coalesce(new.description, ''),
    coalesce((SELECT name FROM categories WHERE id = new.category_id), ''),
    coalesce((SELECT name FROM tenants WHERE id = new.tenant_id), ''),
    coalesce(new.sku, '') || ' ' || coalesce(new.barcode, ''),
    coalesce(new.attributes, '')
  );
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `items_fts_ad` AFTER DELETE ON `items` BEGIN
  DELETE FROM `items_fts` WHERE `item_id` = old.id;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `items_fts_au` AFTER UPDATE ON `items` BEGIN
  DELETE FROM `items_fts` WHERE `item_id` = old.id;
  INSERT INTO `items_fts` (`item_id`, `tenant_id`, `title`, `description`, `category_name`, `store_name`, `sku`, `attributes_text`)
  VALUES (
    new.id,
    new.tenant_id,
    coalesce(new.title, ''),
    coalesce(new.description, ''),
    coalesce((SELECT name FROM categories WHERE id = new.category_id), ''),
    coalesce((SELECT name FROM tenants WHERE id = new.tenant_id), ''),
    coalesce(new.sku, '') || ' ' || coalesce(new.barcode, ''),
    coalesce(new.attributes, '')
  );
END;--> statement-breakpoint
DELETE FROM `items_fts`;--> statement-breakpoint
INSERT INTO `items_fts` (`item_id`, `tenant_id`, `title`, `description`, `category_name`, `store_name`, `sku`, `attributes_text`)
SELECT
  i.id,
  i.tenant_id,
  coalesce(i.title, ''),
  coalesce(i.description, ''),
  coalesce(c.name, ''),
  coalesce(t.name, ''),
  coalesce(i.sku, '') || ' ' || coalesce(i.barcode, ''),
  coalesce(i.attributes, '')
FROM `items` i
LEFT JOIN `categories` c ON c.id = i.category_id
INNER JOIN `tenants` t ON t.id = i.tenant_id;--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-184745'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-184745'),
  `location_id` = 'loc-gn-184745',
  `location_label` = 'Nairobi, Starehe, Nairobi'
WHERE `id` = 'tenant-demo-electronics-02' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-184745');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-8477699'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-8477699'),
  `location_id` = 'loc-gn-8477699',
  `location_label` = 'Kilimani, Dagoretti North, Nairobi'
WHERE `id` = 'tenant-demo-vacanthouse-07' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-8477699');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-osm-30405983'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-osm-30405983'),
  `location_id` = 'loc-osm-30405983',
  `location_label` = 'Kileleshwa, Dagoretti North, Nairobi'
WHERE `id` = 'tenant-demo-salon-03' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-osm-30405983');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-osm-1141424596'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-osm-1141424596'),
  `location_id` = 'loc-osm-1141424596',
  `location_label` = 'Thika, Thika Town, Kiambu'
WHERE `id` = 'tenant-demo-barbershop-04' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-osm-1141424596');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-osm-6346928877'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-osm-6346928877'),
  `location_id` = 'loc-osm-6346928877',
  `location_label` = 'Juja, Juja, Kiambu'
WHERE `id` = 'tenant-demo-portfolio-09' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-osm-6346928877');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-186301'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-186301'),
  `location_id` = 'loc-gn-186301',
  `location_label` = 'Mombasa, Mvita, Mombasa'
WHERE `id` = 'tenant-demo-fashion-01' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-186301');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-184622'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-184622'),
  `location_id` = 'loc-gn-184622',
  `location_label` = 'Nakuru, Nakuru Town East, Nakuru'
WHERE `id` = 'tenant-demo-realestate-08' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-184622');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-198629'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-198629'),
  `location_id` = 'loc-gn-198629',
  `location_label` = 'Eldoret, Turbo, Uasin Gishu'
WHERE `id` = 'tenant-demo-photographer-06' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-198629');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-182701'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-182701'),
  `location_id` = 'loc-gn-182701',
  `location_label` = 'Nyeri, Nyeri Town, Nyeri'
WHERE `id` = 'tenant-demo-massage-05' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-182701');--> statement-breakpoint
UPDATE `tenants`
SET
  `county_id` = (SELECT l.county_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-191245'),
  `constituency_id` = (SELECT l.constituency_id FROM `kenya_locations` l WHERE l.id = 'loc-gn-191245'),
  `location_id` = 'loc-gn-191245',
  `location_label` = 'Kisumu, Kisumu Central, Kisumu'
WHERE `id` = 'tenant-demo-drivingschool-10' AND `location_id` IS NULL AND EXISTS (SELECT 1 FROM `kenya_locations` WHERE `id` = 'loc-gn-191245');
