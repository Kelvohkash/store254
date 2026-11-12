-- ==============================================================
-- Store254 Seed Data: Real Estate Company Demo Business
-- Store: primeacres.store254.co.ke
-- ==============================================================

-- 1. Tenant: PrimeAcres Properties & Land
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-realestate-08',
  'PrimeAcres Properties & Land',
  'primeacres',
  'SERVICES',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#15803d","description":"Trusted Kenyan real estate consultancy offering titled residential plots, commercial land, and off-plan executive housing.","contactEmail":"admin@demo.com","phone":"+254788990011"}',
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner / Admin & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES
  (
    'user-demo-realestate-admin',
    'tenant-demo-realestate-08',
    'admin@demo.com',
    'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
    'PrimeAcres Admin',
    '+254788990011',
    'OWNER',
    'ACTIVE',
    unixepoch(),
    unixepoch()
  ),
  (
    'user-demo-realestate-customer',
    'tenant-demo-realestate-08',
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
-- Root Categories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `description`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  (
    'cat-primeacres-titled-land',
    'tenant-demo-realestate-08',
    NULL,
    'Titled Land & Plots',
    'titled-land-plots',
    'Prime titled residential and commercial parcels with ready freehold title deeds and infrastructure.',
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-primeacres-properties',
    'tenant-demo-realestate-08',
    NULL,
    'Properties For Sale',
    'properties-for-sale',
    'Modern residential developments including executive apartments and gated community townhouses.',
    2,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-primeacres-comm-spaces',
    'tenant-demo-realestate-08',
    NULL,
    'Commercial Spaces',
    'commercial-spaces',
    'Strategically located office suites and commercial buildings suited for corporate and retail operations.',
    3,
    1,
    unixepoch(),
    unixepoch()
  );

-- Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `description`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  (
    'cat-primeacres-50x100',
    'tenant-demo-realestate-08',
    'cat-primeacres-titled-land',
    '50x100 Residential Plots',
    '50x100-plots',
    'Eighth-acre (50x100 ft) ready-to-build plots in thriving satellite towns around Nairobi metro.',
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-primeacres-comm-land',
    'tenant-demo-realestate-08',
    'cat-primeacres-titled-land',
    'Commercial Land',
    'commercial-land',
    'High-yield commercial plots along major transit corridors suitable for plazas, godowns, or retail centers.',
    2,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-primeacres-apartments',
    'tenant-demo-realestate-08',
    'cat-primeacres-properties',
    'Modern Apartments',
    'modern-apartments',
    'Contemporary 1, 2, and 3-bedroom luxury apartments with premium finishes, elevators, and backup power.',
    1,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-primeacres-townhouses',
    'tenant-demo-realestate-08',
    'cat-primeacres-properties',
    'Gated Townhouses',
    'gated-townhouses',
    'Exclusive 4 and 5-bedroom maisonettes and townhouses in master-planned secure communities.',
    2,
    1,
    unixepoch(),
    unixepoch()
  ),
  (
    'cat-primeacres-office-suites',
    'tenant-demo-realestate-08',
    'cat-primeacres-comm-spaces',
    'Office Suites',
    'office-suites',
    'Grade A and B fitted or open-plan commercial office suites in key business districts.',
    1,
    1,
    unixepoch(),
    unixepoch()
  );

-- 4. Dynamic Attribute Definitions
INSERT OR REPLACE INTO `attribute_definitions` (
  `id`, `tenant_id`, `category_id`, `code`, `name`, `type`, `options`, `unit`, `is_filterable`, `is_required`, `display_order`, `created_at`, `updated_at`
) VALUES
  ('attr-re-location', 'tenant-demo-realestate-08', NULL, 'location', 'Location / Area', 'TEXT', '[]', NULL, 1, 1, 1, unixepoch(), unixepoch()),
  ('attr-re-plotsize', 'tenant-demo-realestate-08', NULL, 'plotSize', 'Plot / Property Size', 'TEXT', '[]', NULL, 1, 1, 2, unixepoch(), unixepoch()),
  ('attr-re-titledeed', 'tenant-demo-realestate-08', NULL, 'titleDeedReady', 'Title Deed Ready', 'BOOLEAN', '[]', NULL, 1, 1, 3, unixepoch(), unixepoch()),
  ('attr-re-paymentplan', 'tenant-demo-realestate-08', NULL, 'paymentPlan', 'Payment Plan', 'TEXT', '[]', NULL, 1, 0, 4, unixepoch(), unixepoch());

-- 5. Items (Property Sale Listings)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `stock_quantity`, `status`, `images`, `attributes`, `metadata`, `created_at`, `updated_at`
) VALUES
  (
    'item-primeacres-joska-50x100',
    'tenant-demo-realestate-08',
    'cat-primeacres-50x100',
    'Joska-Kamulu 50x100 Residential Plot - Ready Title Deed',
    'joska-kamulu-50x100-residential-plot',
    'Prime 1/8 acre (50x100 ft) residential plot located in Joska along Kangundo Road. Gently sloping red soil, fully serviced with water, electricity on site, and graded access roads. Ideal for immediate family home development or capital appreciation. Clean, ready freehold title deed with verified search.',
    'SERVICE',
    950000,
    1100000,
    'PRIME-JOS-01',
    12,
    'PUBLISHED',
    '[]',
    '{"location":"Joska, Kangundo Road (Machakos/Nairobi Metro)","plotSize":"50x100 ft (1/8 Acre)","titleDeedReady":true,"paymentPlan":"KES 200,000 deposit, balance over 6 months interest-free","zoning":"Residential","soilType":"Red Soil","utilities":"Water & Electricity On Site"}',
    '{"consultant":"PrimeAcres Land Advisory","siteVisitDays":"Wednesdays and Saturdays"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-juja-farm-50x100',
    'tenant-demo-realestate-08',
    'cat-primeacres-50x100',
    'Juja Farm Phase 3 Controlled Gated Community Plot',
    'juja-farm-phase-3-gated-community-plot',
    'Controlled residential 1/8 acre parcel situated 4.5km off Thika Superhighway along Juja-Farm tarmac. Features perimeter solar fencing, internal cabro access roads, gated security checkpoint, and borehole water connection. Perfect for modern bungalow or maisonette construction.',
    'SERVICE',
    1650000,
    1850000,
    'PRIME-JUJ-02',
    8,
    'PUBLISHED',
    '[]',
    '{"location":"Juja Farm, Kiambu County","plotSize":"50x100 ft (1/8 Acre)","titleDeedReady":true,"paymentPlan":"KES 350,000 deposit, balance in 12 monthly installments","zoning":"Controlled Residential","soilType":"Red Soil","utilities":"Borehole Water & Grid Electricity"}',
    '{"consultant":"PrimeAcres Land Advisory","siteVisitDays":"Wednesdays and Saturdays"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-kitengela-commercial',
    'tenant-demo-realestate-08',
    'cat-primeacres-comm-land',
    'Kitengela Namanga Road Frontage 1/4 Acre Commercial Plot',
    'kitengela-namanga-road-quarter-acre-commercial-plot',
    'Exceptional commercial plot measuring 1/4 acre fronting the Namanga Highway bypass corridor. High footfall and vehicular traffic, zoned for multi-level commercial complex, hospitality, retail strip, or logistics hub. Commercial title deed ready for transfer.',
    'SERVICE',
    6800000,
    7500000,
    'PRIME-KIT-03',
    2,
    'PUBLISHED',
    '[]',
    '{"location":"Kitengela Namanga Highway Bypass, Kajiado County","plotSize":"1/4 Acre (100x100 ft)","titleDeedReady":true,"paymentPlan":"30% deposit, balance within 90 days or bank financing","zoning":"Commercial High-Density","utilities":"3-Phase Power, Council Water, Tarmac Frontage"}',
    '{"consultant":"PrimeAcres Commercial Desk","developmentFeasibility":"Available upon request"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-naivasha-commercial',
    'tenant-demo-realestate-08',
    'cat-primeacres-comm-land',
    'Naivasha Mai Mahiu 1-Acre Commercial & Logistics Hub',
    'naivasha-mai-mahiu-1-acre-commercial-logistics-hub',
    'Strategic 1-acre commercial parcel near the inland container depot (ICD) and SGR terminal interchange. Flat topography, easy heavy-vehicle turning radius, suitable for warehousing, petrol station, or distribution center. Clean leasehold title (99 years).',
    'SERVICE',
    12500000,
    14000000,
    'PRIME-MAI-04',
    1,
    'PUBLISHED',
    '[]',
    '{"location":"Mai Mahiu SGR Interchange, Nakuru County","plotSize":"1.0 Acre","titleDeedReady":true,"paymentPlan":"20% deposit upon sale agreement, 80% upon title transfer","zoning":"Commercial / Light Industrial","utilities":"Heavy Vehicle Access, 3-Phase Power Available"}',
    '{"consultant":"PrimeAcres Commercial Desk","titleType":"Leasehold 99 Years"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-kilimani-apartment',
    'tenant-demo-realestate-08',
    'cat-primeacres-apartments',
    'The Azure: 2-Bedroom Executive Luxury Apartment - Kilimani',
    'azure-kilimani-2-bedroom-luxury-apartment',
    'Magnificent 110 sqm 2-bedroom all en-suite luxury apartment located off Argwings Kodhek Road, Kilimani. Boasts floor-to-ceiling windows, open-plan German fitted kitchen, high-speed lifts, rooftop heated infinity pool, fully equipped gymnasium, and full backup generator.',
    'SERVICE',
    13500000,
    15000000,
    'PRIME-KLM-05',
    6,
    'PUBLISHED',
    '[]',
    '{"location":"Kilimani, Argwings Kodhek Rd, Nairobi","plotSize":"110 sqm plinth area","titleDeedReady":true,"paymentPlan":"20% down payment, 10% quarterly milestones, balance on completion","bedrooms":2,"bathrooms":2,"parking":"2 Dedicated Basement Slots","amenities":"Rooftop Heated Infinity Pool, High-Speed Lifts, Gym, Full Backup Generator"}',
    '{"completionDate":"Q4 2026","serviceCharge":"KES 12,000/month"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-westlands-penthouse',
    'tenant-demo-realestate-08',
    'cat-primeacres-apartments',
    'Westlands Skyline 3-Bedroom Penthouse with DSQ',
    'westlands-skyline-3-bedroom-penthouse-dsq',
    'Spectacular 240 sqm duplex penthouse with panoramic views of Karura Forest and Nairobi skyline. Includes 3 en-suite bedrooms, self-contained DSQ, wrap-around terrace, bespoke Italian cabinetry, smart home automation, and private elevator access.',
    'SERVICE',
    32000000,
    35000000,
    'PRIME-WST-06',
    2,
    'PUBLISHED',
    '[]',
    '{"location":"Westlands / General Mathenge, Nairobi","plotSize":"240 sqm plinth area","titleDeedReady":true,"paymentPlan":"Structured stage payments or approved bank mortgage","bedrooms":3,"bathrooms":4,"parking":"3 Covered Parking Bays","amenities":"Private Elevator Access, Wrap-around Terrace, Smart Home Automation, Borehole"}',
    '{"serviceCharge":"KES 22,000/month","occupancyStatus":"Ready for Occupation"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-karen-villa',
    'tenant-demo-realestate-08',
    'cat-primeacres-townhouses',
    'Karen Miotoni 4-Bedroom Classical Villa on 1/2 Acre',
    'karen-miotoni-4-bedroom-classical-villa',
    'Distinguished 4-bedroom all en-suite residence set within an exclusive 8-unit gated enclave in Miotoni, Karen. Highlights include expansive sunken lounge with mahogany fireplace, mature landscaped manicured garden, family TV room, solar water heating, and 2 staff quarters.',
    'SERVICE',
    45000000,
    48000000,
    'PRIME-KAR-07',
    1,
    'PUBLISHED',
    '[]',
    '{"location":"Miotoni Road, Karen, Nairobi","plotSize":"1/2 Acre (0.2 Hectares)","titleDeedReady":true,"paymentPlan":"Cash purchase or approved bank mortgage facility","bedrooms":4,"bathrooms":5,"parking":"Carport for 4 vehicles","amenities":"Manicured Private Garden, Sunken Fireplace Lounge, Solar Backup, 24/7 Security"}',
    '{"tenure":"Freehold","siteViewing":"Strictly by Appointment"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-primeacres-upperhill-suite',
    'tenant-demo-realestate-08',
    'cat-primeacres-office-suites',
    'Upper Hill Financial District: Grade A Fitted Office Suite (2,500 sq.ft)',
    'upperhill-grade-a-fitted-office-suite-2500sqft',
    'Prime 2,500 sq.ft commercial office suite in a prestigious commercial high-rise in Upper Hill. Fully partitioned with modern glass executive suites, board room, server room, and private kitchenette. Fiber optic backbone, 24/7 CCTV surveillance, and 4 dedicated parking bays.',
    'SERVICE',
    28500000,
    31000000,
    'PRIME-UPH-08',
    3,
    'PUBLISHED',
    '[]',
    '{"location":"Upper Hill, Nairobi","plotSize":"2,500 sq.ft floor area","titleDeedReady":true,"paymentPlan":"Flexible installments over 18 months or commercial mortgage","parking":"4 Dedicated Parking Bays","amenities":"Fiber Optic Backbone, Boardroom, Biometric Access, 100% Generator Backup"}',
    '{"rentalYieldEstimate":"8.5% p.a.","serviceCharge":"KES 28/sq.ft"}',
    unixepoch(),
    unixepoch()
  );

-- 6. Payment Configuration (M-PESA ready, disabled by default)
INSERT OR REPLACE INTO `tenant_payment_configs` (
  `id`, `tenant_id`, `provider`, `is_enabled`, `shortcode_type`, `shortcode`, `passkey`, `consumer_key`, `consumer_secret`, `is_sandbox`, `created_at`, `updated_at`
) VALUES (
  'paycfg-demo-realestate-08',
  'tenant-demo-realestate-08',
  'MPESA',
  0,
  'PAYBILL',
  '174379',
  'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  'mockConsumerKeyPrimeAcres',
  'mockConsumerSecretPrimeAcres',
  1,
  unixepoch(),
  unixepoch()
);
