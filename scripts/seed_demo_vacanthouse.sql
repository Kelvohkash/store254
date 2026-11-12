-- ==============================================================
-- Store254 Seed Data: Demonstration Services Business (Vacant House & Letting)
-- Store: UrbanNest Vacant Homes & Letting (nairobihomes.store254.co.ke)
-- ==============================================================

-- 1. Tenant: UrbanNest Vacant Homes & Letting
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `subscription_due_at`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-vacanthouse-07',
  'UrbanNest Vacant Homes & Letting',
  'nairobihomes',
  'SERVICES',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#0284c7","description":"Verified residential rental listings, vacant apartments, modern studios, and family townhouses across Nairobi.","contactEmail":"admin@demo.com","phone":"+254777889900"}',
  CAST((unixepoch() + 2592000) AS INTEGER) * 1000,
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES
  (
    'user-demo-vacanthouse-admin',
    'tenant-demo-vacanthouse-07',
    'admin@demo.com',
    'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
    'UrbanNest Admin',
    '+254777889900',
    'OWNER',
    'ACTIVE',
    unixepoch(),
    unixepoch()
  ),
  (
    'user-demo-vacanthouse-customer',
    'tenant-demo-vacanthouse-07',
    'demo@demo.com',
    'pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c',
    'Demo Customer',
    '+254700000002',
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
  ('cat-vacant-studios', 'tenant-demo-vacanthouse-07', NULL, 'Studios & Bedsitters', 'studios-bedsitters', 1, 1, unixepoch(), unixepoch()),
  ('cat-vacant-apartments', 'tenant-demo-vacanthouse-07', NULL, '1 & 2 Bedroom Apartments', 'apartments-1-2-bed', 2, 1, unixepoch(), unixepoch()),
  ('cat-vacant-townhouses', 'tenant-demo-vacanthouse-07', NULL, 'Townhouses & Villas', 'townhouses-villas', 3, 1, unixepoch(), unixepoch());

-- Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  ('cat-vacant-exec-studios', 'tenant-demo-vacanthouse-07', 'cat-vacant-studios', 'Executive Studios', 'executive-studios', 1, 1, unixepoch(), unixepoch()),
  ('cat-vacant-budget-bedsitters', 'tenant-demo-vacanthouse-07', 'cat-vacant-studios', 'Budget Bedsitters', 'budget-bedsitters', 2, 1, unixepoch(), unixepoch()),
  ('cat-vacant-1bed-apts', 'tenant-demo-vacanthouse-07', 'cat-vacant-apartments', '1-Bedroom Apartments', '1-bedroom-apartments', 1, 1, unixepoch(), unixepoch()),
  ('cat-vacant-2bed-ensuite', 'tenant-demo-vacanthouse-07', 'cat-vacant-apartments', '2-Bedroom Ensuite', '2-bedroom-ensuite', 2, 1, unixepoch(), unixepoch()),
  ('cat-vacant-3bed-maisonettes', 'tenant-demo-vacanthouse-07', 'cat-vacant-townhouses', '3-Bedroom Maisonettes', '3-bed-maisonettes', 1, 1, unixepoch(), unixepoch()),
  ('cat-vacant-4bed-villas', 'tenant-demo-vacanthouse-07', 'cat-vacant-townhouses', '4-Bedroom Gated Villas', '4-bed-villas', 2, 1, unixepoch(), unixepoch());

-- 4. Dynamic Attribute Definitions
INSERT OR REPLACE INTO `attribute_definitions` (
  `id`, `tenant_id`, `category_id`, `code`, `name`, `type`, `options`, `unit`, `is_filterable`, `is_required`, `display_order`, `created_at`, `updated_at`
) VALUES
  ('attr-vacant-location', 'tenant-demo-vacanthouse-07', NULL, 'location', 'Location', 'TEXT', '[]', NULL, 1, 1, 1, unixepoch(), unixepoch()),
  ('attr-vacant-bedrooms', 'tenant-demo-vacanthouse-07', NULL, 'bedrooms', 'Bedrooms', 'NUMBER', '["0","1","2","3","4"]', NULL, 1, 1, 2, unixepoch(), unixepoch()),
  ('attr-vacant-bathrooms', 'tenant-demo-vacanthouse-07', NULL, 'bathrooms', 'Bathrooms', 'NUMBER', '["1","2","3","4","5"]', NULL, 1, 0, 3, unixepoch(), unixepoch()),
  ('attr-vacant-deposit', 'tenant-demo-vacanthouse-07', NULL, 'deposit', 'Deposit (KES)', 'NUMBER', '[]', 'KES', 1, 1, 4, unixepoch(), unixepoch()),
  ('attr-vacant-furnishing', 'tenant-demo-vacanthouse-07', NULL, 'furnishing', 'Furnishing Status', 'SELECT', '["Unfurnished","Semi-Furnished","Fully Furnished"]', NULL, 1, 0, 5, unixepoch(), unixepoch());

-- 5. Items (Rental Property Listings)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `track_inventory`, `stock_quantity`, `status`, `images`, `attributes`, `created_at`, `updated_at`
) VALUES
  (
    'item-vacant-roysambu-bedsetter',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-budget-bedsitters',
    'Spacious Modern Bedsitter in Roysambu (TRM Drive)',
    'spacious-modern-bedsitter-roysambu-trm-drive',
    'Tiled, well-lit bedsitter located along TRM Drive with 24/7 borehole water, pre-paid token meter, instant hot shower, and CCTV surveillance. 5 minutes walk to Thika Road Mall and public transport.',
    'SERVICE',
    18000,
    20000,
    'PROP-ROY-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Roysambu, TRM Drive","bedrooms":0,"bathrooms":1,"deposit":18000,"furnishing":"Unfurnished","parking":false,"waterSupply":"Borehole & County Council","security":"24/7 Guard & CCTV","floor":3,"serviceCharge":1500}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-kilimani-studio',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-exec-studios',
    'Executive Studio Apartment with Balcony, Kilimani',
    'executive-studio-apartment-balcony-kilimani',
    'Contemporary high-floor studio apartment on Kindaruma Road, Kilimani. Features fitted granite kitchen counters, fitted wardrobes, high-speed lift, rooftop lounge, gym access, and backup generator.',
    'SERVICE',
    38000,
    42000,
    'PROP-KIL-STU',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Kilimani, Kindaruma Road","bedrooms":0,"bathrooms":1,"deposit":38000,"furnishing":"Semi-Furnished","parking":true,"waterSupply":"Borehole + Purifier","amenities":["High-speed Lift","Equipped Gym","Backup Generator","Rooftop Deck"],"serviceCharge":3000}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-kileleshwa-1bed',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-1bed-apts',
    'Sunlit 1-Bedroom Master Ensuite, Kileleshwa',
    'sunlit-1-bedroom-master-ensuite-kileleshwa',
    'Bright and airy 1-bedroom apartment nestled in serene Kileleshwa off Mandera Road. Open-plan kitchen with extractor hood, large private balcony with greenery views, solar water heating, and dedicated basement parking.',
    'SERVICE',
    52000,
    56000,
    'PROP-KIL-1B',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Kileleshwa, Mandera Road","bedrooms":1,"bathrooms":1.5,"deposit":52000,"furnishing":"Unfurnished","parking":true,"waterSupply":"Solar Heating & Borehole","amenities":["Balcony","Basement Parking","CCTV","Intercom"],"serviceCharge":4000}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-westlands-1bed-serviced',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-1bed-apts',
    'Fully Furnished 1-Bedroom Executive Suite, Westlands',
    'fully-furnished-1-bedroom-executive-suite-westlands',
    'Turnkey luxury 1-bedroom suite in Rhapta Road, Westlands. Includes plush king-size bed, 55-inch smart TV, high-speed fiber internet, weekly housekeeping, heated swimming pool, sauna, and restaurant on-site.',
    'SERVICE',
    85000,
    95000,
    'PROP-WST-1B',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Westlands, Rhapta Road","bedrooms":1,"bathrooms":1,"deposit":85000,"furnishing":"Fully Furnished","parking":true,"waterSupply":"Constant Municipal + Tank Reserves","amenities":["Heated Pool","Housekeeping","Sauna","High-speed WiFi"],"serviceCharge":0}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-lavington-2bed-ensuite',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-2bed-ensuite',
    'Modern 2-Bedroom All Ensuite Apartment with DSQ, Lavington',
    'modern-2-bedroom-all-ensuite-apartment-dsq-lavington',
    'Expansive 135 sqm 2-bedroom ensuite apartment along Hatheru Road, Lavington. Boasts separate self-contained staff quarters (DSQ), laundry yard, visitor cloakroom, children play area, solar water heating, and full power backup.',
    'SERVICE',
    78000,
    85000,
    'PROP-LAV-2B',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Lavington, Hatheru Road","bedrooms":2,"bathrooms":2.5,"deposit":78000,"furnishing":"Unfurnished","parking":true,"parkingSlots":2,"waterSupply":"Borehole + Solar Heating","amenities":["Self-contained DSQ","Full Backup Generator","Children Play Area","Perimeter Electric Fence"],"serviceCharge":5000}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-kilimani-2bed-luxury',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-2bed-ensuite',
    'Luxury 2-Bedroom Apartment with Infinity Pool, Kilimani',
    'luxury-2-bedroom-apartment-infinity-pool-kilimani',
    'Impeccable architectural masterpiece along Dennis Pritt Road. Floor-to-ceiling glass windows, German sanitary fittings, open-plan island kitchen, rooftop infinity swimming pool, wellness club, and biometric access.',
    'SERVICE',
    92000,
    100000,
    'PROP-KIL-2B',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Kilimani, Dennis Pritt Road","bedrooms":2,"bathrooms":2,"deposit":92000,"furnishing":"Unfurnished","parking":true,"parkingSlots":2,"waterSupply":"City Council + Borehole","amenities":["Rooftop Infinity Pool","Biometric Access","Wellness Gym","Full Backup Generator"],"serviceCharge":6000}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-southc-3bed-maisonette',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-3bed-maisonettes',
    'Elegant 3-Bedroom Maisonette in Gated Court, South C',
    'elegant-3-bedroom-maisonette-gated-court-south-c',
    'Charming double-storey 3-bedroom family maisonette in a quiet, strictly controlled gated community in South C. Features private front garden, spacious dining lounge, detached servant quarters, and 2 designated car ports.',
    'SERVICE',
    110000,
    120000,
    'PROP-STHC-3B',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"South C, Bellevue Court","bedrooms":3,"bathrooms":3,"deposit":110000,"furnishing":"Unfurnished","parking":true,"parkingSlots":2,"waterSupply":"County Water + 10,000L Underground Tank","amenities":["Private Garden","Detached DSQ","Gated Community","Solar Water Heating"],"serviceCharge":4500}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-vacant-karen-4bed-villa',
    'tenant-demo-vacanthouse-07',
    'cat-vacant-4bed-villas',
    'Luxury 4-Bedroom Gated Villa with Private Garden, Karen',
    'luxury-4-bedroom-gated-villa-private-garden-karen',
    'Exclusive country-living villa set on half-acre manicured garden within an ultra-secure gated estate in Karen near The Hub. Features sunken living room with fireplace, en-suite bedrooms, family TV room, 2 DSQs, and electric boundary.',
    'SERVICE',
    180000,
    200000,
    'PROP-KAR-4B',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"location":"Karen, Miotoni Road","bedrooms":4,"bathrooms":4.5,"deposit":180000,"furnishing":"Unfurnished","parking":true,"parkingSlots":4,"waterSupply":"Borehole + Solar Hot Water","amenities":["Half-Acre Private Garden","Fireplace","2 DSQs","Clubhouse Access","Security Patrol"],"serviceCharge":10000}',
    unixepoch(),
    unixepoch()
  );

-- 6. Payment Configuration (MPESA Disabled by default)
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-vacanthouse-07',
  'tenant-demo-vacanthouse-07',
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
