-- ==============================================================
-- Store254 Seed Data: Demonstration Multi-Category Business
-- Store: alicebabycare.store254.co.ke
-- ==============================================================

-- 1. Tenant: Alice Baby Care & Electronics
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-alice-babycare-101',
  'Alice Baby Care & Electronics',
  'alicebabycare',
  'GENERAL',
  'KES',
  'ACTIVE',
  '{"theme":"modern","contactEmail":"alice@store254.co.ke","phone":"254712345678","description":"Top quality baby essentials, smart electronics, and nursery consulting services in Nairobi."}',
  unixepoch(),
  unixepoch()
);

-- 2. Owner Account (alice@store254.co.ke / Password123!)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES (
  'user-alice-owner-101',
  'tenant-alice-babycare-101',
  'alice@store254.co.ke',
  'pbkdf2$sha512$100000$ff34cc30a376077a16b2a374d91d89d7$c9dca99f4ea789b1474ddd1f55d6b90449cdc50bb2edd9460b51682b1fba982e5654c0ec69eee53a425f3e06368e2ee206bb7779beba801a6ad777a6c5a85169',
  'Alice Mutua',
  '254712345678',
  'OWNER',
  'ACTIVE',
  unixepoch(),
  unixepoch()
);

-- 3. Hierarchical Categories
-- Root Categories
INSERT OR REPLACE INTO `categories` (`id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat-electronics', 'tenant-alice-babycare-101', NULL, 'Electronics', 'electronics', 1, 1, unixepoch(), unixepoch()),
  ('cat-babycare', 'tenant-alice-babycare-101', NULL, 'Baby Care', 'baby-care', 2, 1, unixepoch(), unixepoch()),
  ('cat-services', 'tenant-alice-babycare-101', NULL, 'Services & Consultations', 'services', 3, 1, unixepoch(), unixepoch());

-- Subcategories (Nested under Electronics)
INSERT OR REPLACE INTO `categories` (`id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat-tv', 'tenant-alice-babycare-101', 'cat-electronics', 'Smart TVs', 'smart-tvs', 1, 1, unixepoch(), unixepoch()),
  ('cat-audio', 'tenant-alice-babycare-101', 'cat-electronics', 'Audio & Woofers', 'audio-woofers', 2, 1, unixepoch(), unixepoch()),
  ('cat-strollers', 'tenant-alice-babycare-101', 'cat-babycare', 'Strollers & Prams', 'strollers', 1, 1, unixepoch(), unixepoch());

-- 4. Dynamic Attribute Definitions
INSERT OR REPLACE INTO `attribute_definitions` (
  `id`, `tenant_id`, `category_id`, `code`, `name`, `type`, `options`, `unit`, `is_filterable`, `is_required`, `display_order`, `created_at`, `updated_at`
) VALUES
  ('attr-brand', 'tenant-alice-babycare-101', NULL, 'brand', 'Brand', 'SELECT', '["Samsung","Sony","LG","Chicco","Graco"]', NULL, 1, 1, 1, unixepoch(), unixepoch()),
  ('attr-screen-size', 'tenant-alice-babycare-101', 'cat-tv', 'screen_size', 'Screen Size', 'NUMBER', '["43","55","65"]', 'inches', 1, 1, 2, unixepoch(), unixepoch()),
  ('attr-resolution', 'tenant-alice-babycare-101', 'cat-tv', 'resolution', 'Resolution', 'SELECT', '["Full HD","4K UHD","8K"]', NULL, 1, 0, 3, unixepoch(), unixepoch()),
  ('attr-duration', 'tenant-alice-babycare-101', 'cat-services', 'duration_minutes', 'Service Duration', 'NUMBER', '["30","60","120"]', 'mins', 1, 1, 1, unixepoch(), unixepoch());

-- 5. Items (Products & Services)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `stock_quantity`, `status`, `attributes`, `created_at`, `updated_at`
) VALUES
  (
    'item-samsung-55-tv',
    'tenant-alice-babycare-101',
    'cat-tv',
    'Samsung 55" Crystal UHD 4K Smart TV',
    'samsung-55-crystal-uhd-4k-smart-tv',
    'Vibrant Crystal processor 4K with HDR10+ and built-in Tizen OS.',
    'PHYSICAL',
    54999,
    62000,
    'SAM-55-4K-01',
    15,
    'PUBLISHED',
    '{"brand":"Samsung","screen_size":55,"resolution":"4K UHD","warranty":"24 Months"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-sony-65-oled-tv',
    'tenant-alice-babycare-101',
    'cat-tv',
    'Sony Bravia 65" OLED 4K Google TV',
    'sony-bravia-65-oled-4k-google-tv',
    'Cognitive Processor XR with pure black OLED panel and Acoustic Surface Audio+.',
    'PHYSICAL',
    115000,
    130000,
    'SNY-65-OLED-01',
    8,
    'PUBLISHED',
    '{"brand":"Sony","screen_size":65,"resolution":"4K UHD","warranty":"24 Months"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-sony-woofer',
    'tenant-alice-babycare-101',
    'cat-audio',
    'Sony High Power Home Party Woofer 5.1ch',
    'sony-high-power-home-party-woofer',
    'Immersive 1000W surround sound with wireless rear speakers and subwoofer.',
    'PHYSICAL',
    28500,
    32000,
    'SNY-WF-1000W',
    12,
    'PUBLISHED',
    '{"brand":"Sony","warranty":"12 Months"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-chicco-stroller',
    'tenant-alice-babycare-101',
    'cat-strollers',
    'Chicco Bravo 3-in-1 Trio Travel System Stroller',
    'chicco-bravo-3-in-1-stroller',
    'Includes KeyFit 30 infant car seat with multi-position reclining seat and one-hand fold.',
    'PHYSICAL',
    45000,
    52000,
    'CHC-BRV-01',
    6,
    'PUBLISHED',
    '{"brand":"Chicco","color":"Charcoal Grey","max_weight":"22kg"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-nursery-service',
    'tenant-alice-babycare-101',
    'cat-services',
    'Professional Child Safety & Nursery Setup Consultation',
    'child-safety-nursery-setup-consultation',
    'One-on-one in-home or virtual consultation for childproofing and ergonomic nursery layout.',
    'SERVICE',
    3500,
    NULL,
    'SRV-NURS-01',
    999,
    'PUBLISHED',
    '{"duration_minutes":60,"consultant":"Alice Mutua (Certified Child Safety Specialist)"}',
    unixepoch(),
    unixepoch()
  );

-- 6. Promotions & Coupon Offers
INSERT OR REPLACE INTO `promotions` (
  `id`, `tenant_id`, `title`, `code`, `discount_type`, `discount_value`, `min_order_amount`, `applies_to`, `starts_at`, `ends_at`, `is_active`, `created_at`, `updated_at`
) VALUES
  (
    'promo-welcome10',
    'tenant-alice-babycare-101',
    'Welcome 10% Off Storewide',
    'WELCOME10',
    'PERCENTAGE',
    10,
    2000,
    'ALL',
    unixepoch(),
    unixepoch() + 31536000, -- 1 year validity
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'promo-flash500',
    'tenant-alice-babycare-101',
    'Flash Sale: KES 500 Off',
    'FLASH500',
    'FIXED_AMOUNT',
    500,
    5000,
    'ALL',
    unixepoch(),
    unixepoch() + 31536000,
    1,
    unixepoch(),
    unixepoch()
  );

-- 7. Payment Configuration: Disabled by Default
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-alice-101',
  'tenant-alice-babycare-101',
  'MPESA',
  0, -- Disabled by default!
  'PAYBILL',
  '174379',
  'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  'mockConsumerKey123',
  'mockConsumerSecret456',
  1,
  unixepoch(),
  unixepoch()
);
