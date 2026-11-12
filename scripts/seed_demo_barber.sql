-- ==============================================================
-- Store254 Seed Data: Demonstration Services Business (Barber Shop)
-- Store: The Executive Barber Club (executivecuts.store254.co.ke)
-- ==============================================================

-- 1. Tenant: The Executive Barber Club
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-barbershop-04',
  'The Executive Barber Club',
  'executivecuts',
  'SERVICES',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#d97706","description":"Premier gentleman''s grooming lounge offering precision fades, hot towel razor shaves, and executive treatments.","contactEmail":"admin@demo.com","phone":"+254744556677"}',
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES
  (
    'user-demo-barbershop-admin',
    'tenant-demo-barbershop-04',
    'admin@demo.com',
    'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
    'Executive Cuts Admin',
    '+254744556677',
    'OWNER',
    'ACTIVE',
    unixepoch(),
    unixepoch()
  ),
  (
    'user-demo-barbershop-customer',
    'tenant-demo-barbershop-04',
    'demo@demo.com',
    'pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c',
    'Demo Customer',
    '+254700000001',
    'CUSTOMER',
    'ACTIVE',
    unixepoch(),
    unixepoch()
  );

-- 3. Hierarchical Categories
-- Top-level Parent Categories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  ('cat-barber-haircuts', 'tenant-demo-barbershop-04', NULL, 'Precision Haircuts', 'haircuts', 1, 1, unixepoch(), unixepoch()),
  ('cat-barber-beard', 'tenant-demo-barbershop-04', NULL, 'Beard & Facial Grooming', 'beard-grooming', 2, 1, unixepoch(), unixepoch()),
  ('cat-barber-vip', 'tenant-demo-barbershop-04', NULL, 'VIP Packages', 'vip-packages', 3, 1, unixepoch(), unixepoch());

-- Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  ('cat-barber-fade', 'tenant-demo-barbershop-04', 'cat-barber-haircuts', 'Classic Fade & Taper', 'fade-taper', 1, 1, unixepoch(), unixepoch()),
  ('cat-barber-scissors', 'tenant-demo-barbershop-04', 'cat-barber-haircuts', 'Executive Scissors Cut', 'scissors-cut', 2, 1, unixepoch(), unixepoch()),
  ('cat-barber-junior', 'tenant-demo-barbershop-04', 'cat-barber-haircuts', 'Junior Cut', 'junior-cut', 3, 1, unixepoch(), unixepoch()),
  ('cat-barber-hot-towel', 'tenant-demo-barbershop-04', 'cat-barber-beard', 'Hot Towel Shave', 'hot-towel-shave', 1, 1, unixepoch(), unixepoch()),
  ('cat-barber-beard-dye', 'tenant-demo-barbershop-04', 'cat-barber-beard', 'Beard Darkening & Conditioning', 'beard-dye', 2, 1, unixepoch(), unixepoch()),
  ('cat-barber-presidential', 'tenant-demo-barbershop-04', 'cat-barber-vip', 'Presidential Full Grooming', 'presidential-package', 1, 1, unixepoch(), unixepoch()),
  ('cat-barber-dreadlocks', 'tenant-demo-barbershop-04', 'cat-barber-vip', 'Dreadlocks Retwist', 'dreadlocks-styling', 2, 1, unixepoch(), unixepoch());

-- 4. Items (Services)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `track_inventory`, `stock_quantity`, `status`, `images`, `attributes`, `created_at`, `updated_at`
) VALUES
  (
    'item-barber-fade-signature',
    'tenant-demo-barbershop-04',
    'cat-barber-fade',
    'Signature Skin Fade & Razor Lineup',
    'signature-skin-fade-razor-lineup',
    'Custom low, mid, or high taper fade with foil finish, sharp razor edge alignment, and soothing aftershave treatment.',
    'SERVICE',
    1200,
    1500,
    'SRV-FADE-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":45,"barberGrade":"Master Barber","includesBeverage":true,"scalpTreatment":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-scissors-executive',
    'tenant-demo-barbershop-04',
    'cat-barber-scissors',
    'Executive Scissor Cut & Matte Styling',
    'executive-scissor-cut-matte-styling',
    'Precision shears cut for medium to long gentleman hair, complete with scalp massage wash and matte pomade styling.',
    'SERVICE',
    1800,
    2200,
    'SRV-SCIS-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":50,"barberGrade":"Senior Stylist","includesBeverage":true,"stylingProductIncluded":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-junior-gent',
    'tenant-demo-barbershop-04',
    'cat-barber-junior',
    'Young Gentleman Haircut',
    'young-gentleman-haircut',
    'Patient, gentle precision haircut for boys under 12 with styled finish and complimentary junior snack juice.',
    'SERVICE',
    800,
    1000,
    'SRV-JUN-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":30,"barberGrade":"Barber","includesBeverage":true,"ageLimit":"Under 12"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-hot-towel-royal',
    'tenant-demo-barbershop-04',
    'cat-barber-hot-towel',
    'Royal Hot Towel Straight Razor Shave',
    'royal-hot-towel-straight-razor-shave',
    'Classic wet shave experience with pre-shave aromatherapy oils, hot lather, steamed towels, and cold-compress post-shave balm.',
    'SERVICE',
    1500,
    1800,
    'SRV-SHAV-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":40,"barberGrade":"Master Barber","includesBeverage":true,"aromatherapy":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-beard-enhancement',
    'tenant-demo-barbershop-04',
    'cat-barber-beard-dye',
    'Beard Sculpting, Conditioning & Darkening',
    'beard-sculpting-conditioning-darkening',
    'Sharp line shaping, organic beard color darkening to conceal grays, followed by a hot oil beard butter condition.',
    'SERVICE',
    1600,
    2000,
    'SRV-BEARD-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":45,"barberGrade":"Senior Stylist","includesBeverage":true,"colorType":"Semi-Permanent Organic"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-presidential-vip',
    'tenant-demo-barbershop-04',
    'cat-barber-presidential',
    'The Presidential Full Grooming Package',
    'the-presidential-full-grooming-package',
    'Signature precision haircut, hot towel razor shave or beard styling, deep pore charcoal facial mask, and rejuvenating head and shoulder massage.',
    'SERVICE',
    4800,
    6000,
    'SRV-VIP-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":90,"barberGrade":"Master Barber","includesBeverage":true,"facialIncluded":true,"massageIncluded":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-dreadlocks-retwist',
    'tenant-demo-barbershop-04',
    'cat-barber-dreadlocks',
    'Dreadlocks Detox Wash, Retwist & Styling',
    'dreadlocks-detox-wash-retwist-styling',
    'Clarifying ACV & tea tree rinse, palm roll retwist with natural flaxseed gel, and clean scalp drying and barrel roll styling.',
    'SERVICE',
    3200,
    3800,
    'SRV-LOCS-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":75,"barberGrade":"Senior Loctician","includesBeverage":true,"stylingIncluded":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-barber-express-beard',
    'tenant-demo-barbershop-04',
    'cat-barber-hot-towel',
    'Express Beard Trim & Cheek Line',
    'express-beard-trim-cheek-line',
    'Clipper trim, perimeter straight-razor detailing, and sandalwood beard oil finish for men on the move.',
    'SERVICE',
    900,
    1100,
    'SRV-BEARD-EXP',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":25,"barberGrade":"Barber","includesBeverage":false}',
    unixepoch(),
    unixepoch()
  );

-- 5. Payment Configuration (MPESA Disabled by default)
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-barbershop-04',
  'tenant-demo-barbershop-04',
  'MPESA',
  0,
  'PAYBILL',
  '174379',
  'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  'mockConsumerKey123',
  'mockConsumerSecret456',
  1,
  unixepoch(),
  unixepoch()
);
