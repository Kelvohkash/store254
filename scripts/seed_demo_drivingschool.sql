-- ==============================================================
-- Store254 Seed Data: Demonstration Services Business (Driving School)
-- Store: Apex SafeDrive Driving Academy (safedrive.store254.co.ke)
-- Tenant ID: tenant-demo-drivingschool-10
-- ==============================================================

-- 1. Tenant: Apex SafeDrive Driving Academy
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-drivingschool-10',
  'Apex SafeDrive Driving Academy',
  'safedrive',
  'SERVICES',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#ea580c","description":"NTSA-certified driving school in Nairobi providing comprehensive manual & automatic driving courses, motorcycle licensing, and defensive driving.","contactEmail":"admin@demo.com","phone":"+254700112233"}',
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES
  (
    'user-demo-drivingschool-admin',
    'tenant-demo-drivingschool-10',
    'admin@demo.com',
    'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
    'Apex SafeDrive Admin',
    '+254700112233',
    'OWNER',
    'ACTIVE',
    unixepoch(),
    unixepoch()
  ),
  (
    'user-demo-drivingschool-customer',
    'tenant-demo-drivingschool-10',
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
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  ('cat-drive-class-b', 'tenant-demo-drivingschool-10', NULL, 'Light Vehicles (Class B)', 'light-vehicles-class-b', 1, 1, unixepoch(), unixepoch()),
  ('cat-drive-class-a', 'tenant-demo-drivingschool-10', NULL, 'Motorcycle & TukTuk (Class A)', 'motorcycle-class-a', 2, 1, unixepoch(), unixepoch()),
  ('cat-drive-advanced', 'tenant-demo-drivingschool-10', NULL, 'Refresher & Advanced', 'refresher-advanced', 3, 1, unixepoch(), unixepoch());

-- 3.2 Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  ('cat-drive-manual', 'tenant-demo-drivingschool-10', 'cat-drive-class-b', 'Manual Transmission', 'manual-transmission', 1, 1, unixepoch(), unixepoch()),
  ('cat-drive-auto', 'tenant-demo-drivingschool-10', 'cat-drive-class-b', 'Automatic Transmission', 'automatic-transmission', 2, 1, unixepoch(), unixepoch()),
  ('cat-drive-bodaboda', 'tenant-demo-drivingschool-10', 'cat-drive-class-a', 'Class A2 Bodaboda', 'class-a2-bodaboda', 1, 1, unixepoch(), unixepoch()),
  ('cat-drive-tuktuk', 'tenant-demo-drivingschool-10', 'cat-drive-class-a', 'Class A3 TukTuk', 'class-a3-tuktuk', 2, 1, unixepoch(), unixepoch()),
  ('cat-drive-refresher', 'tenant-demo-drivingschool-10', 'cat-drive-advanced', 'Driver Refresher Lessons', 'driver-refresher', 1, 1, unixepoch(), unixepoch()),
  ('cat-drive-defensive', 'tenant-demo-drivingschool-10', 'cat-drive-advanced', 'Defensive Driving Certification', 'defensive-driving', 2, 1, unixepoch(), unixepoch());

-- 4. Dynamic Attribute Definitions
INSERT OR REPLACE INTO `attribute_definitions` (
  `id`, `tenant_id`, `category_id`, `code`, `name`, `type`, `options`, `unit`, `is_filterable`, `is_required`, `display_order`, `created_at`, `updated_at`
) VALUES
  ('attr-drive-vehicle', 'tenant-demo-drivingschool-10', NULL, 'vehicleType', 'Vehicle Type', 'TEXT', '[]', NULL, 1, 1, 1, unixepoch(), unixepoch()),
  ('attr-drive-lessons', 'tenant-demo-drivingschool-10', NULL, 'lessonsCount', 'Number of Lessons', 'NUMBER', '[]', 'lessons', 1, 1, 2, unixepoch(), unixepoch()),
  ('attr-drive-duration', 'tenant-demo-drivingschool-10', NULL, 'durationWeeks', 'Duration', 'NUMBER', '[]', 'weeks', 1, 1, 3, unixepoch(), unixepoch()),
  ('attr-drive-ntsa', 'tenant-demo-drivingschool-10', NULL, 'ntsaExamIncluded', 'NTSA Exam Included', 'BOOLEAN', '[]', NULL, 1, 0, 4, unixepoch(), unixepoch());

-- 5. Items (Driving Course Packages)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `track_inventory`, `stock_quantity`, `status`, `images`, `attributes`, `created_at`, `updated_at`
) VALUES
  (
    'item-drive-manual-comp',
    'tenant-demo-drivingschool-10',
    'cat-drive-manual',
    'Comprehensive Manual Driving Course (Class B)',
    'comprehensive-manual-driving-course',
    'Full 30-lesson foundational manual salon car training covering vehicle controls, hill starts, complex roundabout navigation, highway driving, mechanical theory, and complete NTSA test booking.',
    'SERVICE',
    18500,
    21000,
    'DRV-B-MAN-COMP',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Manual Saloon Car","lessonsCount":30,"durationWeeks":4,"ntsaExamIncluded":true,"firstAidCertified":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-manual-exp',
    'tenant-demo-drivingschool-10',
    'cat-drive-manual',
    'Express Fast-Track Manual Course (Class B)',
    'express-fast-track-manual-course',
    'Intensive 2-week fast-track manual vehicle course with dual daily sessions for quick learners, university students, and urgent NTSA driving license requirements.',
    'SERVICE',
    15500,
    17500,
    'DRV-B-MAN-EXP',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Manual Saloon Car","lessonsCount":20,"durationWeeks":2,"ntsaExamIncluded":true,"firstAidCertified":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-auto-std',
    'tenant-demo-drivingschool-10',
    'cat-drive-auto',
    'Automatic Saloon Vehicle Course (Class B)',
    'automatic-saloon-vehicle-course',
    'Master effortless city commuting in modern automatic vehicles. Includes parallel parking, multi-story basement maneuvering, roundabout etiquette, highway dynamics, and NTSA examination endorsement.',
    'SERVICE',
    17500,
    20000,
    'DRV-B-AUT-STD',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Automatic Hatchback/Saloon","lessonsCount":25,"durationWeeks":3,"ntsaExamIncluded":true,"firstAidCertified":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-auto-exec',
    'tenant-demo-drivingschool-10',
    'cat-drive-auto',
    'Executive SUV Automatic VIP Course (Class B)',
    'executive-suv-automatic-vip-course',
    'Premium executive training conducted in modern compact SUVs equipped with reversing cameras, lane-departure warnings, parking sensors, and complimentary home or office door-to-door instructor pickup.',
    'SERVICE',
    22000,
    25000,
    'DRV-B-AUT-EXEC',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Automatic Compact SUV","lessonsCount":28,"durationWeeks":4,"ntsaExamIncluded":true,"doorstepPickup":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-moto-a2',
    'tenant-demo-drivingschool-10',
    'cat-drive-bodaboda',
    'Class A2 Bodaboda & Motorcycle Rider Certification',
    'class-a2-bodaboda-motorcycle-certification',
    'Complete motorcycle riding curriculum covering low-speed balance, countersteering, emergency braking maneuvers, lane discipline, rider safety PPE gear, and NTSA practical licensing test.',
    'SERVICE',
    7500,
    9000,
    'DRV-A-MOTO-A2',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"150cc Motorcycle","lessonsCount":15,"durationWeeks":2,"ntsaExamIncluded":true,"protectiveGearProvided":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-tuktuk-a3',
    'tenant-demo-drivingschool-10',
    'cat-drive-tuktuk',
    'Class A3 Three-Wheeler (TukTuk) Professional Course',
    'class-a3-tuktuk-professional-course',
    'Commercial 3-wheeler tricycle training specifically tailored for urban transit, passenger safety protocols, tight cornering physics, reversing in narrow lanes, and NTSA testing.',
    'SERVICE',
    8500,
    10000,
    'DRV-A-TUK-A3',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Commercial TukTuk (Tricycle)","lessonsCount":16,"durationWeeks":2,"ntsaExamIncluded":true,"passengerSafety":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-refresher-urban',
    'tenant-demo-drivingschool-10',
    'cat-drive-refresher',
    'Urban Refresher & Nairobi Traffic Confidence Package',
    'urban-refresher-traffic-confidence-package',
    'Designed for licensed drivers needing a confidence boost in Nairobi roundabouts, expressway driving, rush hour navigation, hill parking, and tight underground mall parking.',
    'SERVICE',
    6500,
    8000,
    'DRV-REF-URB-10',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Manual or Automatic","lessonsCount":10,"durationWeeks":1,"ntsaExamIncluded":false,"customRoutes":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-drive-defensive-adv',
    'tenant-demo-drivingschool-10',
    'cat-drive-defensive',
    'Corporate Defensive Driving & Hazard Avoidance Masterclass',
    'corporate-defensive-driving-hazard-masterclass',
    'Accredited advanced road hazard perception, collision avoidance techniques, skid recovery dynamics, night driving safety, anti-hijack situational awareness, and certified corporate evaluation certificate.',
    'SERVICE',
    14000,
    16500,
    'DRV-DEF-ADV-01',
    0,
    999,
    'PUBLISHED',
    '[]',
    '{"vehicleType":"Fleet Saloon & 4x4","lessonsCount":12,"durationWeeks":1,"ntsaExamIncluded":false,"corporateCertificate":true}',
    unixepoch(),
    unixepoch()
  );

-- 6. Payment Configuration (MPESA Disabled by default)
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-drivingschool-10',
  'tenant-demo-drivingschool-10',
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
