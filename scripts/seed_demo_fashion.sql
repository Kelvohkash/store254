-- ==============================================================
-- Store254 Seed Data: Fashion Store Demo
-- Store: zuritrends.store254.co.ke
-- Tenant: Zuri Trends Kenya (tenant-demo-fashion-01)
-- ==============================================================

-- 1. Tenant: Zuri Trends Kenya
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-fashion-01',
  'Zuri Trends Kenya',
  'zuritrends',
  'RETAIL',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#e11d48","description":"Curated Nairobi contemporary fashion boutique with quality clothes, designer shoes, and premium accessories.","contactEmail":"admin@demo.com","phone":"+254711223344"}',
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts
-- 2.1 Store Owner / Admin (admin@demo.com / Password123!)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES (
  'user-demo-fashion-admin',
  'tenant-demo-fashion-01',
  'admin@demo.com',
  'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
  'Zuri Trends Admin',
  '+254711223344',
  'OWNER',
  'ACTIVE',
  unixepoch(),
  unixepoch()
);

-- 2.2 Demo Customer (demo@demo.com / Password123!)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES (
  'user-demo-fashion-customer',
  'tenant-demo-fashion-01',
  'demo@demo.com',
  'pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c',
  'Demo Customer',
  '+254700000001',
  'CUSTOMER',
  'ACTIVE',
  unixepoch(),
  unixepoch()
);

-- 3. Categories (Parent & Subcategories)
-- 3.1 Top-Level Root Categories
INSERT OR REPLACE INTO `categories` (`id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat-fashion-clothes', 'tenant-demo-fashion-01', NULL, 'Clothes', 'clothes', 1, 1, unixepoch(), unixepoch()),
  ('cat-fashion-shoes', 'tenant-demo-fashion-01', NULL, 'Shoes', 'shoes', 2, 1, unixepoch(), unixepoch()),
  ('cat-fashion-accessories', 'tenant-demo-fashion-01', NULL, 'Accessories', 'accessories', 3, 1, unixepoch(), unixepoch());

-- 3.2 Subcategories under Clothes
INSERT OR REPLACE INTO `categories` (`id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat-fashion-mens', 'tenant-demo-fashion-01', 'cat-fashion-clothes', 'Men''s Fashion', 'mens-fashion', 1, 1, unixepoch(), unixepoch()),
  ('cat-fashion-womens', 'tenant-demo-fashion-01', 'cat-fashion-clothes', 'Women''s Fashion', 'womens-fashion', 2, 1, unixepoch(), unixepoch()),
  ('cat-fashion-streetwear', 'tenant-demo-fashion-01', 'cat-fashion-clothes', 'Casual & Streetwear', 'casual-streetwear', 3, 1, unixepoch(), unixepoch());

-- 3.3 Subcategories under Shoes
INSERT OR REPLACE INTO `categories` (`id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat-fashion-sneakers', 'tenant-demo-fashion-01', 'cat-fashion-shoes', 'Sneakers', 'sneakers', 1, 1, unixepoch(), unixepoch()),
  ('cat-fashion-formal-loafers', 'tenant-demo-fashion-01', 'cat-fashion-shoes', 'Formal & Loafers', 'formal-loafers', 2, 1, unixepoch(), unixepoch()),
  ('cat-fashion-heels-boots', 'tenant-demo-fashion-01', 'cat-fashion-shoes', 'Heels & Boots', 'heels-boots', 3, 1, unixepoch(), unixepoch());

-- 3.4 Subcategories under Accessories
INSERT OR REPLACE INTO `categories` (`id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat-fashion-bags-backpacks', 'tenant-demo-fashion-01', 'cat-fashion-accessories', 'Bags & Backpacks', 'bags-backpacks', 1, 1, unixepoch(), unixepoch()),
  ('cat-fashion-belts-wallets', 'tenant-demo-fashion-01', 'cat-fashion-accessories', 'Belts & Wallets', 'belts-wallets', 2, 1, unixepoch(), unixepoch());

-- 4. Dynamic Attribute Definitions
INSERT OR REPLACE INTO `attribute_definitions` (
  `id`, `tenant_id`, `category_id`, `code`, `name`, `type`, `options`, `unit`, `is_filterable`, `is_required`, `display_order`, `created_at`, `updated_at`
) VALUES
  ('attr-fashion-brand', 'tenant-demo-fashion-01', NULL, 'brand', 'Brand', 'SELECT', '["Zuri Atelier","Zuri Heritage","Zuri Urban","Zuri Footwear","Zuri Sartorial","Zuri Leatherworks"]', NULL, 1, 0, 1, unixepoch(), unixepoch()),
  ('attr-fashion-size', 'tenant-demo-fashion-01', NULL, 'size', 'Size', 'SELECT', '["S","M","L","XL","EU 37","EU 38","EU 39","EU 40","EU 41","EU 42","EU 43","EU 44","EU 45"]', NULL, 1, 0, 2, unixepoch(), unixepoch()),
  ('attr-fashion-color', 'tenant-demo-fashion-01', NULL, 'color', 'Color', 'SELECT', '["Olive Green","Crimson & Gold","Charcoal Black","Triple White","Burnished Cognac","Terracotta Suede","Caramel Tan","Navy Blue"]', NULL, 1, 0, 3, unixepoch(), unixepoch()),
  ('attr-fashion-material', 'tenant-demo-fashion-01', NULL, 'material', 'Material', 'TEXT', '[]', NULL, 1, 0, 4, unixepoch(), unixepoch());

-- 5. Items (Fashion Products)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `stock_quantity`, `status`, `images`, `attributes`, `created_at`, `updated_at`
) VALUES
  (
    'item-fashion-linen-shirt',
    'tenant-demo-fashion-01',
    'cat-fashion-mens',
    'Safari Classic Linen Long-Sleeve Shirt',
    'safari-classic-linen-shirt',
    'Breathable, premium 100% European flax linen shirt crafted for effortless elegance in Nairobi warmer days or evening dinners.',
    'PHYSICAL',
    3800,
    4500,
    'ZUR-MS-001',
    25,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Atelier","size":"M, L, XL","color":"Olive Green","material":"100% European Linen","fit":"Regular Fit"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-ankara-wrap-dress',
    'tenant-demo-fashion-01',
    'cat-fashion-womens',
    'Swahili Sunset Ankara Maxi Wrap Dress',
    'swahili-sunset-ankara-maxi-wrap-dress',
    'Exquisite handcrafted Ankara print wrap dress featuring vibrant gold and deep crimson geometric motifs with adjustable waist belt.',
    'PHYSICAL',
    5200,
    6000,
    'ZUR-WD-002',
    18,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Heritage","size":"S, M, L","color":"Crimson & Gold","material":"100% Wax Cotton","pattern":"Geometric Ankara"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-oversized-hoodie',
    'tenant-demo-fashion-01',
    'cat-fashion-streetwear',
    'Nairobi 254 Heavyweight Oversized Hoodie',
    'nairobi-254-heavyweight-oversized-hoodie',
    'Ultra-comfortable 450 GSM French terry cotton hoodie with embroidered 254 chest insignia and kangaroo pocket.',
    'PHYSICAL',
    4200,
    4800,
    'ZUR-HD-003',
    30,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Urban","size":"S, M, L, XL","color":"Charcoal Black","material":"100% Heavyweight Cotton","weight":"450 GSM"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-leather-sneakers',
    'tenant-demo-fashion-01',
    'cat-fashion-sneakers',
    'Mara Minimalist White Leather Sneakers',
    'mara-minimalist-white-leather-sneakers',
    'Timeless low-top sneakers crafted from supple full-grain Italian leather with cushioned memory foam insoles for all-day city walks.',
    'PHYSICAL',
    6500,
    7800,
    'ZUR-SNK-004',
    14,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Footwear","size":"EU 40, 41, 42, 43, 44","color":"Triple White","material":"Full-Grain Leather","sole":"Durable Rubber"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-penny-loafers',
    'tenant-demo-fashion-01',
    'cat-fashion-formal-loafers',
    'Executive Handcrafted Leather Penny Loafers',
    'executive-handcrafted-leather-penny-loafers',
    'Sophisticated burnished cognac leather penny loafers with Goodyear welted construction, perfect for boardroom meetings and upscale cocktail events.',
    'PHYSICAL',
    8500,
    9800,
    'ZUR-LOA-005',
    10,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Sartorial","size":"EU 41, 42, 43, 44, 45","color":"Burnished Cognac","material":"Calfskin Leather","construction":"Goodyear Welted"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-block-heel-mules',
    'tenant-demo-fashion-01',
    'cat-fashion-heels-boots',
    'Sienna Suede Block Heel Mules',
    'sienna-suede-block-heel-mules',
    'Chic 2.5-inch sculptural block heel mules in velvety terracotta suede with cushioned footbed and modern square toe.',
    'PHYSICAL',
    4900,
    5600,
    'ZUR-HLS-006',
    16,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Footwear","size":"EU 37, 38, 39, 40, 41","color":"Terracotta Suede","heel_height":"2.5 inches","toe_style":"Square Toe"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-leather-tote-bag',
    'tenant-demo-fashion-01',
    'cat-fashion-bags-backpacks',
    'Rift Valley Full-Grain Leather Everyday Tote',
    'rift-valley-full-grain-leather-everyday-tote',
    'Spacious structured tote bag handcrafted from Kenyan pull-up leather, featuring dedicated 15-inch laptop sleeve and brass hardware.',
    'PHYSICAL',
    7500,
    8800,
    'ZUR-BAG-007',
    12,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Leatherworks","size":"Large (16 x 13 x 5 in)","color":"Caramel Tan","material":"Full-Grain Pull-Up Leather","hardware":"Solid Antiqued Brass"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-fashion-leather-wallet-belt-set',
    'tenant-demo-fashion-01',
    'cat-fashion-belts-wallets',
    'Savannah Reversible Leather Belt & Bifold Wallet Gift Set',
    'savannah-reversible-leather-belt-and-wallet-set',
    'Dual-sided black/brown genuine leather belt paired with an RFID-blocking slim bifold card wallet in a luxury presentation box.',
    'PHYSICAL',
    3200,
    3900,
    'ZUR-ACC-008',
    22,
    'PUBLISHED',
    '[]',
    '{"brand":"Zuri Leatherworks","size":"Adjustable 32-42 in","color":"Dual Tone Black/Dark Brown","material":"Genuine Cowhide Leather","features":"RFID Protection, Reversible Buckle"}',
    unixepoch(),
    unixepoch()
  );

-- 6. Payment Configuration (M-Pesa disabled by default until merchant configures keys)
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-demo-fashion-01',
  'tenant-demo-fashion-01',
  'MPESA',
  0,
  'PAYBILL',
  '174379',
  'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  'demoConsumerKey123',
  'demoConsumerSecret456',
  1,
  unixepoch(),
  unixepoch()
);
