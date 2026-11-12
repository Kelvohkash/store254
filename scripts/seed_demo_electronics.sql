-- ==============================================================
-- Store254 Demo Seeding Script: Nexus Tech Hub (Electronics)
-- Tenant: tenant-demo-electronics-02 (Subdomain: nexustech)
-- ==============================================================

-- 1. Tenant: Nexus Tech Hub
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-electronics-02',
  'Nexus Tech Hub',
  'nexustech',
  'ELECTRONICS',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#2563eb","description":"Your trusted Nairobi electronics shop for premium smartphones, audio gear, and everyday computing essentials.","contactEmail":"admin@demo.com","phone":"+254722334455"}',
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner / Admin & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES
(
  'user-demo-electronics-admin',
  'tenant-demo-electronics-02',
  'admin@demo.com',
  'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
  'Nexus Tech Admin',
  '+254722334455',
  'OWNER',
  'ACTIVE',
  unixepoch(),
  unixepoch()
),
(
  'user-demo-electronics-customer',
  'tenant-demo-electronics-02',
  'demo@demo.com',
  'pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c',
  'Demo Customer',
  '+254711223344',
  'CUSTOMER',
  'ACTIVE',
  unixepoch(),
  unixepoch()
);

-- 3. Categories (Hierarchical: Top categories and nested subcategories)
-- Top Categories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
(
  'cat-nexus-smartphones-tablets',
  'tenant-demo-electronics-02',
  NULL,
  'Smartphones & Tablets',
  'smartphones-tablets',
  1,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-audio-sound',
  'tenant-demo-electronics-02',
  NULL,
  'Audio & Sound',
  'audio-sound',
  2,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-computing-power',
  'tenant-demo-electronics-02',
  NULL,
  'Computing & Power',
  'computing-power',
  3,
  1,
  unixepoch(),
  unixepoch()
);

-- Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
(
  'cat-nexus-smartphones',
  'tenant-demo-electronics-02',
  'cat-nexus-smartphones-tablets',
  'Smartphones',
  'smartphones',
  1,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-tablets-ipads',
  'tenant-demo-electronics-02',
  'cat-nexus-smartphones-tablets',
  'Tablets & iPads',
  'tablets-ipads',
  2,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-wireless-earbuds',
  'tenant-demo-electronics-02',
  'cat-nexus-audio-sound',
  'Wireless Earbuds',
  'wireless-earbuds',
  1,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-bluetooth-speakers',
  'tenant-demo-electronics-02',
  'cat-nexus-audio-sound',
  'Bluetooth Speakers',
  'bluetooth-speakers',
  2,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-power-banks',
  'tenant-demo-electronics-02',
  'cat-nexus-computing-power',
  'Power Banks',
  'power-banks',
  1,
  1,
  unixepoch(),
  unixepoch()
),
(
  'cat-nexus-chargers-cables',
  'tenant-demo-electronics-02',
  'cat-nexus-computing-power',
  'Fast Chargers & Cables',
  'chargers-cables',
  2,
  1,
  unixepoch(),
  unixepoch()
);

-- 4. Products (Items)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`,
  `base_price`, `compare_at_price`, `cost_price`, `sku`, `barcode`,
  `track_inventory`, `stock_quantity`, `status`, `images`, `attributes`, `metadata`,
  `created_at`, `updated_at`
) VALUES
(
  'item-nexus-samsung-a55',
  'tenant-demo-electronics-02',
  'cat-nexus-smartphones',
  'Samsung Galaxy A55 5G (256GB / 8GB RAM)',
  'samsung-galaxy-a55-5g-256gb',
  'Samsung Galaxy A55 5G with 6.6-inch Super AMOLED 120Hz display, 50MP triple OIS camera system, metal frame design, and 5000mAh all-day battery with 25W fast charging.',
  'PHYSICAL',
  48500,
  53000,
  43000,
  'NX-SAM-A55-256',
  '8806095012345',
  1,
  15,
  'PUBLISHED',
  '[]',
  '{"brand":"Samsung","storage":"256GB","ram":"8GB","battery":"5000mAh","warranty":"24 Months","connectivity":"5G","color":"Awesome Iceblue"}',
  '{"weight":"213g","box_contents":["Smartphone","USB Type-C Cable","Ejection Pin","Quick Start Guide"]}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-xiaomi-redmi-note-13',
  'tenant-demo-electronics-02',
  'cat-nexus-smartphones',
  'Xiaomi Redmi Note 13 Pro (256GB / 8GB RAM)',
  'xiaomi-redmi-note-13-pro-256gb',
  'Equipped with an ultra-clear 200MP main camera with OIS, 67W turbo charging with included adapter, 120Hz FHD+ AMOLED display, and MediaTek Helio G99-Ultra.',
  'PHYSICAL',
  32500,
  36000,
  28500,
  'NX-XIA-RN13P-256',
  '6941812754321',
  1,
  22,
  'PUBLISHED',
  '[]',
  '{"brand":"Xiaomi","storage":"256GB","ram":"8GB","battery":"5000mAh","warranty":"12 Months","camera":"200MP Triple Camera","color":"Midnight Black"}',
  '{"fast_charging":"67W Turbo Charge","box_contents":["Redmi Note 13 Pro","67W Adapter","USB Type-C Cable","Protective Case"]}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-apple-ipad-10th-gen',
  'tenant-demo-electronics-02',
  'cat-nexus-tablets-ipads',
  'Apple iPad 10th Gen 10.9-inch Wi-Fi (64GB)',
  'apple-ipad-10th-gen-10-9-64gb-wifi',
  'Striking 10.9-inch Liquid Retina display, fast A14 Bionic chip, landscape 12MP Ultra Wide front camera with Center Stage, USB-C, and support for Apple Pencil and Magic Keyboard Folio.',
  'PHYSICAL',
  59000,
  65000,
  52000,
  'NX-APL-IPAD10-64',
  '194253385210',
  1,
  9,
  'PUBLISHED',
  '[]',
  '{"brand":"Apple","storage":"64GB","screen_size":"10.9 inches","chip":"A14 Bionic","warranty":"12 Months Apple Warranty","color":"Silver"}',
  '{"display":"Liquid Retina 2360x1640","box_contents":["iPad 10th Gen","USB-C Charge Cable (1m)","20W USB-C Power Adapter"]}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-sony-wf-c700n',
  'tenant-demo-electronics-02',
  'cat-nexus-wireless-earbuds',
  'Sony WF-C700N Truly Wireless Noise Canceling Earbuds',
  'sony-wf-c700n-wireless-noise-canceling-earbuds',
  'Block out background noise with Noise Sensor Technology, switch to Ambient Sound Mode to hear your surroundings, IPX4 splash proof rating, and Multipoint connection.',
  'PHYSICAL',
  13500,
  15500,
  10800,
  'NX-SNY-WFC700N-BLK',
  '4548736145612',
  1,
  28,
  'PUBLISHED',
  '[]',
  '{"brand":"Sony","battery_life":"15 Hours (with case)","noise_cancelling":"Digital Noise Cancelling (ANC)","water_resistance":"IPX4","warranty":"12 Months","color":"Black"}',
  '{"bluetooth":"v5.2","codecs":"SBC, AAC","multipoint":true}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-oraimo-freepods-4',
  'tenant-demo-electronics-02',
  'cat-nexus-wireless-earbuds',
  'Oraimo FreePods 4 Active Noise Cancelling Earbuds',
  'oraimo-freepods-4-anc-earbuds',
  'Active Noise Cancellation up to 30dB, 4-mic call noise reduction with clear voice technology, Oraimo Sound App tuning, IPX5 water resistance, and 35.5-hour endurance.',
  'PHYSICAL',
  4500,
  5200,
  3300,
  'NX-ORM-FP4-ANC',
  '4895180778811',
  1,
  45,
  'PUBLISHED',
  '[]',
  '{"brand":"Oraimo","battery_life":"35.5 Hours total","noise_cancelling":"30dB Hybrid ANC","water_resistance":"IPX5","warranty":"12 Months","color":"Black"}',
  '{"driver_size":"10mm dynamic drivers","app_support":"Oraimo Sound App"}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-jbl-flip-6',
  'tenant-demo-electronics-02',
  'cat-nexus-bluetooth-speakers',
  'JBL Flip 6 Portable Waterproof Bluetooth Speaker',
  'jbl-flip-6-portable-waterproof-speaker',
  '2-way speaker system engineered for loud, crystal-clear, powerful sound with dual passive radiators. IP67 waterproof and dustproof with up to 12 hours playtime.',
  'PHYSICAL',
  15800,
  18000,
  12500,
  'NX-JBL-FLIP6-BLK',
  '050036384789',
  1,
  16,
  'PUBLISHED',
  '[]',
  '{"brand":"JBL","output_power":"30W RMS","battery_life":"12 Hours","water_resistance":"IP67","warranty":"12 Months","color":"Midnight Black"}',
  '{"frequency_response":"63 Hz - 20k Hz","bluetooth":"v5.1","partyboost":true}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-anker-325-powerbank',
  'tenant-demo-electronics-02',
  'cat-nexus-power-banks',
  'Anker 325 Power Bank (PowerCore 20K II)',
  'anker-325-power-bank-20000mah',
  'Huge 20,000mAh capacity provides over 4 full charges for iPhone 15 or 3 charges for Galaxy S24. Dual USB-A outputs with PowerIQ high-speed charging.',
  'PHYSICAL',
  5200,
  6000,
  3900,
  'NX-ANK-325-20K',
  '194644021345',
  1,
  38,
  'PUBLISHED',
  '[]',
  '{"brand":"Anker","capacity":"20000mAh","output_ports":"2x USB-A (15W Max)","input_ports":"USB-C and Micro USB","warranty":"18 Months","color":"Black"}',
  '{"dimensions":"158 x 74 x 19 mm","weight":"465g"}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-baseus-gan5-65w',
  'tenant-demo-electronics-02',
  'cat-nexus-chargers-cables',
  'Baseus GaN5 Pro 65W Fast Charger (2x USB-C + 1x USB-A)',
  'baseus-gan5-pro-65w-fast-charger',
  'Fifth-generation GaN technology offers upgraded cooling and ultra-compact size. Supports 65W PD fast charge for laptops, MacBooks, tablets, and smartphones. Includes 100W 1m cable.',
  'PHYSICAL',
  3600,
  4300,
  2600,
  'NX-BAS-GAN5P-65W',
  '6932172619854',
  1,
  40,
  'PUBLISHED',
  '[]',
  '{"brand":"Baseus","power":"65W","ports":"2x USB-C + 1x USB-A","fast_charging":"PD 3.0, QC 4+, PPS, AFC","warranty":"12 Months","color":"Black"}',
  '{"cable_included":"100W USB-C to USB-C (1m)","voltage":"100-240V ~ 50/60Hz"}',
  unixepoch(),
  unixepoch()
),
(
  'item-nexus-oraimo-duraline2-cable',
  'tenant-demo-electronics-02',
  'cat-nexus-chargers-cables',
  'Oraimo DuraLine 2 Braided Type-C Fast Charging Cable (1m)',
  'oraimo-duraline-2-braided-type-c-cable',
  'High-durability nylon braided cable supporting 3A rapid charging and 480Mbps high-speed data transfer. Tested for 20,000+ bends.',
  'PHYSICAL',
  1800,
  2200,
  1100,
  'NX-ORM-DL2-USBC',
  '4895180765439',
  1,
  65,
  'PUBLISHED',
  '[]',
  '{"brand":"Oraimo","length":"1.0 Meter","current":"3A Fast Charging","connector":"USB-A to USB-C","warranty":"12 Months","material":"Double Braided Nylon"}',
  '{"data_transfer_speed":"480 Mbps","bend_lifespan":"20000+ bends"}',
  unixepoch(),
  unixepoch()
);
