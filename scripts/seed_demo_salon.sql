-- ==============================================================
-- Store254 Demo Store Seed Script: Hair Salon & Spa Business
-- Store: Lush & Glow Hair Salon (lushsalon.store254.co.ke)
-- Tenant ID: tenant-demo-salon-03
-- ==============================================================

-- 1. Tenant Definition
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `custom_domain`, `business_type`, `currency`, `status`, `settings`, `subscription_due_at`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-salon-03',
  'Lush & Glow Hair Salon',
  'lushsalon',
  NULL,
  'SERVICES',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#db2777","description":"Bespoke hair styling, luxury braids, nail bar, and rejuvenating facial treatments in Kilimani.","contactEmail":"admin@demo.com","phone":"+254733445566"}',
  NULL,
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner Admin & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `last_login_at`, `avatar_url`, `google_id`, `created_at`, `updated_at`
) VALUES
  (
    'user-demo-salon-admin',
    'tenant-demo-salon-03',
    'admin@demo.com',
    'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
    'Lush Salon Admin',
    '+254733445566',
    'OWNER',
    'ACTIVE',
    NULL,
    NULL,
    NULL,
    unixepoch(),
    unixepoch()
  ),
  (
    'user-demo-salon-customer',
    'tenant-demo-salon-03',
    'demo@demo.com',
    'pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c',
    'Demo Customer',
    '+254711223344',
    'CUSTOMER',
    'ACTIVE',
    NULL,
    NULL,
    NULL,
    unixepoch(),
    unixepoch()
  );

-- 3. Categories (Parent and Nested Subcategories)
-- Top Level Categories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `description`, `icon`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  (
    'cat-salon-hair',
    'tenant-demo-salon-03',
    NULL,
    'Hair Styling & Braids',
    'hair-styling-braids',
    'Premium protective braiding, lace wig installs, and revitalizing hair wash treatments.',
    'Sparkles',
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-nails',
    'tenant-demo-salon-03',
    NULL,
    'Nails & Spa',
    'nails-spa',
    'High-end Russian dry manicures, BIAB overlays, and relaxing jelly spa pedicures.',
    'Heart',
    2,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-facials',
    'tenant-demo-salon-03',
    NULL,
    'Facials & Skin',
    'facials-skin',
    'Clinical grade deep cleansing, oxygen infusion, and rejuvenating skin therapies.',
    'Sun',
    3,
    1,
    unixepoch(),
    unixepoch()
  );

-- Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `description`, `icon`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  (
    'cat-salon-knotless',
    'tenant-demo-salon-03',
    'cat-salon-hair',
    'Knotless Braids',
    'knotless-braids',
    'Seamless, tension-free knotless box braids, bohemian curls, and goddess styles.',
    NULL,
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-wig-install',
    'tenant-demo-salon-03',
    'cat-salon-hair',
    'Wig Installation',
    'wig-install',
    'HD lace frontals, closure wigs, glueless installs, and custom plucked hairlines.',
    NULL,
    2,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-wash-treatment',
    'tenant-demo-salon-03',
    'cat-salon-hair',
    'Wash & Treatment',
    'wash-treatment',
    'Steam hydration, intensive keratin protein repair, and silk press styling.',
    NULL,
    3,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-gel-acrylic',
    'tenant-demo-salon-03',
    'cat-salon-nails',
    'Gel & Acrylic Nails',
    'gel-acrylic-nails',
    'Russian manicure, BIAB builder gel, acrylic full sets, and luxury nail art.',
    NULL,
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-spa-pedicure',
    'tenant-demo-salon-03',
    'cat-salon-nails',
    'Spa Pedicure',
    'spa-pedicure',
    'Aromatherapy jelly soaks, callous removal peel, paraffin wax, and foot massage.',
    NULL,
    2,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-salon-deep-cleansing',
    'tenant-demo-salon-03',
    'cat-salon-facials',
    'Deep Cleansing Facial',
    'deep-cleansing-facial',
    'Vortex hydro-dermabrasion, ultrasonic extractions, and LED light radiance.',
    NULL,
    1,
    1,
    unixepoch(),
    unixepoch()
  );

-- 4. Attribute Definitions
INSERT OR REPLACE INTO `attribute_definitions` (
  `id`, `tenant_id`, `category_id`, `code`, `name`, `type`, `options`, `unit`, `is_filterable`, `is_required`, `display_order`, `created_at`, `updated_at`
) VALUES
  (
    'attr-salon-duration',
    'tenant-demo-salon-03',
    NULL,
    'duration',
    'Duration',
    'TEXT',
    '["60 mins","75 mins","90 mins","120 mins","150 mins","180 mins","210 mins","300 mins"]',
    NULL,
    1,
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'attr-salon-stylist-level',
    'tenant-demo-salon-03',
    NULL,
    'stylistLevel',
    'Stylist Level',
    'SELECT',
    '["Stylist","Senior Stylist","Master Braider","Senior Nail Artist","Pedicurist","Certified Aesthetician"]',
    NULL,
    1,
    0,
    2,
    unixepoch(),
    unixepoch()
  ),
  (
    'attr-salon-includes-wash',
    'tenant-demo-salon-03',
    NULL,
    'includesWash',
    'Includes Wash',
    'BOOLEAN',
    '["true","false"]',
    NULL,
    1,
    0,
    3,
    unixepoch(),
    unixepoch()
  );

-- 5. Items (Salon Services)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `cost_price`, `sku`, `barcode`, `track_inventory`, `stock_quantity`, `status`, `images`, `attributes`, `metadata`, `created_at`, `updated_at`
) VALUES
  (
    'item-salon-knotless-midback',
    'tenant-demo-salon-03',
    'cat-salon-knotless',
    'Medium Knotless Braids (Mid-Back)',
    'medium-knotless-braids-mid-back',
    'Lightweight, tension-free knotless braids styled to mid-back length with neat parts. Includes deep cleansing wash, blow-dry, and silky mousse setting.',
    'SERVICE',
    4500,
    5500,
    NULL,
    'SRV-KNOT-MID',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"210 mins","stylistLevel":"Senior Stylist","includesWash":true,"hairLength":"Mid-Back","braidSize":"Medium"}',
    '{"depositRequired":false,"aftercare":"Wrap with satin scarf nightly; apply scalp oil 3x weekly."}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-boho-knotless-waist',
    'tenant-demo-salon-03',
    'cat-salon-knotless',
    'Goddess Boho Knotless Braids (Waist Length)',
    'goddess-boho-knotless-braids-waist-length',
    'Signature bohemian knotless braids featuring raw human hair curls woven throughout for high-volume boho luxury. Lightweight on the scalp with durable hold.',
    'SERVICE',
    8500,
    10000,
    NULL,
    'SRV-BOHO-WST',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"300 mins","stylistLevel":"Master Braider","includesWash":true,"hairLength":"Waist Length","braidSize":"Small-Medium"}',
    '{"curlType":"100% Virgin Human Hair Curls","recommendedLongevity":"6-8 weeks"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-hd-lace-wig-install',
    'tenant-demo-salon-03',
    'cat-salon-wig-install',
    'HD Lace Frontal Wig Customization & Installation',
    'hd-lace-frontal-wig-customization-installation',
    'Seamless ghost lace melt with bleached knots, customized plucked hairline, flat cornrow braid base, scalp protector, and silk press or soft glam curls styling.',
    'SERVICE',
    6000,
    7500,
    NULL,
    'SRV-WIG-INST',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"150 mins","stylistLevel":"Senior Stylist","includesWash":true,"stylingFinish":"Silk Press / Hollywood Waves","meltTechnique":"HD Invisible Melt"}',
    '{"laceDropOff":"Drop off wig 24 hours prior to appointment for bleached knots & custom tinting."}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-silk-press-steam',
    'tenant-demo-salon-03',
    'cat-salon-wash-treatment',
    'Hydrating Steam Treatment & Silk Press',
    'hydrating-steam-treatment-silk-press',
    'Sulfate-free scalp clarifying wash, deep ozone steam moisture therapy, botanical leave-in infusion, split-end micro-trim, and glass-finish titanium silk press.',
    'SERVICE',
    3500,
    4200,
    NULL,
    'SRV-SILK-STM',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"90 mins","stylistLevel":"Senior Stylist","includesWash":true,"treatmentType":"Hydrating Ozone Steam Therapy","heatProtectant":"Keratin Thermal Shield"}',
    '{"benefits":"Restores hair elasticity and yields high movement without chemical relaxers."}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-protein-repair',
    'tenant-demo-salon-03',
    'cat-salon-wash-treatment',
    'Intensive Biotin & Keratin Bond Repair',
    'intensive-biotin-keratin-bond-repair',
    'Clinically formulated bond builder and biotin treatment to halt breakage, reconstruct weakened cortex fibers, and fortify fragile color-treated hair.',
    'SERVICE',
    2800,
    3500,
    NULL,
    'SRV-BIOT-REP',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"75 mins","stylistLevel":"Stylist","includesWash":true,"treatmentType":"Bond Reconstruction Mask"}',
    '{"recommendedFor":"Bleached, relaxed, or heat-fatigued hair"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-russian-biab-manicure',
    'tenant-demo-salon-03',
    'cat-salon-gel-acrylic',
    'Russian Dry Manicure & BIAB Builder Gel Overlay',
    'russian-dry-manicure-biab-builder-gel-overlay',
    'Medical-grade e-file precision cuticle alignment, apex strengthening Builder In A Bottle overlay, chip-free gel polish, and scented jojoba oil massage.',
    'SERVICE',
    3000,
    3800,
    NULL,
    'SRV-RUS-BIAB',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"75 mins","stylistLevel":"Senior Nail Artist","includesWash":false,"technique":"Russian Dry Cuticle Care","durability":"3-4 weeks"}',
    '{"strengthening":"Helps natural nails grow long and prevents splitting."}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-jelly-spa-pedicure',
    'tenant-demo-salon-03',
    'cat-salon-spa-pedicure',
    'Signature Jelly Spa Pedicure & Callus Peel',
    'signature-jelly-spa-pedicure-callus-peel',
    'Aromatherapy warm jelly foot soak, fruit enzyme callus peel, sugar crystal exfoliation, warming paraffin booties, hot basalt stone calf massage, and gel polish.',
    'SERVICE',
    3500,
    4500,
    NULL,
    'SRV-SPA-PEDI',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"80 mins","stylistLevel":"Pedicurist","includesWash":false,"spaAddon":"Hot Stone & Paraffin Wax","polishType":"Gel Polish"}',
    '{"scentSelection":"Eucalyptus Mint or Lavender Bliss"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-salon-hydra-glow-facial',
    'tenant-demo-salon-03',
    'cat-salon-deep-cleansing',
    'Hydra-Glow Deep Cleansing & Oxygen Infusion Facial',
    'hydra-glow-deep-cleansing-oxygen-infusion-facial',
    'Comprehensive medical aesthetic facial featuring vortex suction pore cleansing, painless blackhead extraction, lactic peel, hyperbaric oxygen serum mist, and soothing LED light therapy.',
    'SERVICE',
    5500,
    7000,
    NULL,
    'SRV-HYD-GLOW',
    NULL,
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"duration":"90 mins","stylistLevel":"Certified Aesthetician","includesWash":false,"skinType":"All Skin Types","technology":"Hydro-Dermabrasion & LED Therapy"}',
    '{"results":"Immediate glowing complexion, pore refinement, and deep hydration."}',
    unixepoch(),
    unixepoch()
  );

-- 6. Optional Payment Configuration (Disabled by default for demo setup)
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-demo-salon-03',
  'tenant-demo-salon-03',
  'MPESA',
  0,
  'TILL',
  '899201',
  'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  'mockDemoSalonConsumerKey',
  'mockDemoSalonConsumerSecret',
  1,
  unixepoch(),
  unixepoch()
);
