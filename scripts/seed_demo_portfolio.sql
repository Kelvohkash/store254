-- ==============================================================
-- Store254 Seed Data: Demonstration Services Business (Personal Portfolio)
-- Store: Alex Kimani | Cloud & Web Engineer (alexkimani.store254.co.ke)
-- Tenant ID: tenant-demo-portfolio-09
-- ==============================================================

-- 1. Tenant: Alex Kimani | Cloud & Web Engineer
INSERT OR REPLACE INTO `tenants` (
  `id`, `name`, `subdomain`, `business_type`, `currency`, `status`, `settings`, `created_at`, `updated_at`
) VALUES (
  'tenant-demo-portfolio-09',
  'Alex Kimani | Cloud & Web Engineer',
  'alexkimani',
  'SERVICES',
  'KES',
  'ACTIVE',
  '{"theme":"modern","primaryColor":"#7c3aed","description":"Independent Full-Stack Software Engineer & Cloud Architect specializing in scalable web apps, mobile solutions, and UX design.","contactEmail":"admin@demo.com","phone":"+254799001122"}',
  unixepoch(),
  unixepoch()
);

-- 2. Auth Accounts (Owner & Demo Customer)
INSERT OR REPLACE INTO `users` (
  `id`, `tenant_id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `created_at`, `updated_at`
) VALUES
  (
    'user-demo-portfolio-admin',
    'tenant-demo-portfolio-09',
    'admin@demo.com',
    'pbkdf2$sha512$100000$3d29aa15a970e1fdeac9d6d57d2863f9$682a5c5e5a279f675ed7dcd9c3a3bd1b8f434b7082d93a48897f29ea0f20f866eb48d77b8eab66bc57576a336c51562d258dcd13e5115cf41b76978b003f2575',
    'Alex Kimani',
    '+254799001122',
    'OWNER',
    'ACTIVE',
    unixepoch(),
    unixepoch()
  ),
  (
    'user-demo-portfolio-customer',
    'tenant-demo-portfolio-09',
    'demo@demo.com',
    'pbkdf2$sha512$100000$dde6530e852bb302b2bb17283e0739b6$8f4c31e3e04f40779f18ba17a45a7ee0a924da1378bb73f1fd855c4d6b8fdffab1378807dbb326b175b64d9a0df5942c2d806d15e2131db1d1d4d748616f088c',
    'Demo Customer',
    '+254700000000',
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
  ('cat-port-fullstack', 'tenant-demo-portfolio-09', NULL, 'Full-Stack Development', 'fullstack-dev', 1, 1, unixepoch(), unixepoch()),
  ('cat-port-uiux', 'tenant-demo-portfolio-09', NULL, 'UI/UX & Product Design', 'ui-ux-design', 2, 1, unixepoch(), unixepoch()),
  ('cat-port-consulting', 'tenant-demo-portfolio-09', NULL, 'Technical Consulting', 'technical-consulting', 3, 1, unixepoch(), unixepoch());

-- Subcategories
INSERT OR REPLACE INTO `categories` (
  `id`, `tenant_id`, `parent_id`, `name`, `slug`, `display_order`, `is_active`, `created_at`, `updated_at`
) VALUES
  ('cat-port-web-apps', 'tenant-demo-portfolio-09', 'cat-port-fullstack', 'Custom Web Apps', 'custom-web-apps', 1, 1, unixepoch(), unixepoch()),
  ('cat-port-mobile-apps', 'tenant-demo-portfolio-09', 'cat-port-fullstack', 'Mobile Apps', 'mobile-apps', 2, 1, unixepoch(), unixepoch()),
  ('cat-port-figma-kits', 'tenant-demo-portfolio-09', 'cat-port-uiux', 'Figma UI Kits', 'figma-ui-kits', 1, 1, unixepoch(), unixepoch()),
  ('cat-port-brand-identity', 'tenant-demo-portfolio-09', 'cat-port-uiux', 'Brand Identity', 'brand-identity', 2, 1, unixepoch(), unixepoch()),
  ('cat-port-cloud-audit', 'tenant-demo-portfolio-09', 'cat-port-consulting', 'Cloud Architecture Audit', 'cloud-audit', 1, 1, unixepoch(), unixepoch()),
  ('cat-port-dev-mentorship', 'tenant-demo-portfolio-09', 'cat-port-consulting', 'Developer Mentorship', 'dev-mentorship', 2, 1, unixepoch(), unixepoch());

-- 4. Items (Software Consulting Services & Packages)
INSERT OR REPLACE INTO `items` (
  `id`, `tenant_id`, `category_id`, `title`, `slug`, `description`, `item_type`, `base_price`, `compare_at_price`, `sku`, `track_inventory`, `stock_quantity`, `status`, `images`, `attributes`, `created_at`, `updated_at`
) VALUES
  (
    'item-port-saas-mvp',
    'tenant-demo-portfolio-09',
    'cat-port-web-apps',
    'Full-Stack SaaS MVP Development',
    'fullstack-saas-mvp-development',
    'Turn your product concept into a launch-ready SaaS web application in 4 weeks. Includes responsive frontend in Next.js / Tailwind CSS, high-throughput Hono/Node API backend, PostgreSQL/D1 database setup, tenant authentication, and Stripe/M-Pesa payment integration.',
    'SERVICE',
    220000,
    250000,
    'PORT-SaaS-MVP',
    0,
    5,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":4,"techStack":"Next.js, TypeScript, Tailwind CSS, Hono, PostgreSQL/D1","revisions":3,"deliverables":"Production Web Application, GitHub Repository, CI/CD Pipeline, Architecture Blueprint"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-ecommerce-platform',
    'tenant-demo-portfolio-09',
    'cat-port-web-apps',
    'Custom Headless E-Commerce Platform',
    'custom-headless-ecommerce-platform',
    'High-performance, modern headless e-commerce storefront tailored for East African and global trade. Integrated automated M-Pesa Daraja STK Push, card checkout, inventory sync, and SEO-optimized product catalogs.',
    'SERVICE',
    165000,
    195000,
    'PORT-ECOM-CUST',
    0,
    5,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":3,"techStack":"Next.js, Cloudflare Workers, D1 Database, M-Pesa API, Tailwind CSS","revisions":2,"deliverables":"Custom Online Storefront, Admin Inventory Dashboard, Payment Gateway Webhooks, Analytics Integration"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-mobile-app',
    'tenant-demo-portfolio-09',
    'cat-port-mobile-apps',
    'Cross-Platform Mobile Application (iOS & Android)',
    'cross-platform-mobile-app',
    'Native-feel cross-platform mobile app built with React Native / Expo. Features secure biometric authentication, offline synchronization, push notifications, and end-to-end guidance through Google Play & Apple App Store submission.',
    'SERVICE',
    245000,
    280000,
    'PORT-MOB-CROSS',
    0,
    4,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":6,"techStack":"React Native, Expo, TypeScript, REST API, Firebase Push Notifications","revisions":3,"deliverables":"iOS & Android App Binaries, Full Source Code, App Store Listing Assets, Developer Handover"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-figma-design-system',
    'tenant-demo-portfolio-09',
    'cat-port-figma-kits',
    'Custom Design System & Figma UI Kit',
    'custom-design-system-figma-ui-kit',
    'Production-ready, highly modular design system crafted in Figma. Includes comprehensive typography scale, tokenized color palettes, light/dark mode variants, responsive auto-layout components, and developer handoff guidelines.',
    'SERVICE',
    75000,
    90000,
    'PORT-DSN-FIGMA',
    0,
    10,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":2,"techStack":"Figma, Design Tokens, Auto-Layout 5.0, Component Variants","revisions":3,"deliverables":"Master Figma Workspace (.fig), Token Hierarchy Export (JSON/Tailwind), Style Guide Documentation"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-brand-identity-pack',
    'tenant-demo-portfolio-09',
    'cat-port-brand-identity',
    'Tech Startup Brand Identity & Visual Assets',
    'tech-startup-brand-identity-visual-assets',
    'Holistic corporate visual identity for tech companies, SaaS tools, and digital ventures. Covers primary/secondary logo design, favicon suite, social banner templates, investor deck styling, and corporate brand guidelines.',
    'SERVICE',
    55000,
    68000,
    'PORT-BRD-START',
    0,
    10,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":2,"techStack":"Adobe Illustrator, Figma, Vector Formats (SVG, EPS, PDF)","revisions":4,"deliverables":"High-res Vector Logos, Brand Stylebook (PDF), Pitch Deck Slide Templates, Favicon & Social Media Pack"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-cloud-audit',
    'tenant-demo-portfolio-09',
    'cat-port-cloud-audit',
    'Cloud Architecture & Security Cost Optimization Audit',
    'cloud-architecture-security-cost-optimization-audit',
    'Comprehensive forensic review of your AWS, GCP, or Cloudflare cloud infrastructure. We isolate latency hotspots, security vulnerabilities, misconfigured IAM roles, and identify immediate cost reductions of 30-60%.',
    'SERVICE',
    85000,
    110000,
    'PORT-CLD-AUDIT',
    0,
    12,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":1,"techStack":"AWS, Cloudflare Edge, Terraform, Docker, PostgreSQL/MySQL","revisions":1,"deliverables":"Executive Audit Report (PDF), Infrastructure Security Scorecard, Cloud Cost Reduction Roadmap, 90-Min Strategy Call"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-serverless-migration',
    'tenant-demo-portfolio-09',
    'cat-port-cloud-audit',
    'Legacy Server to Serverless Edge Migration',
    'legacy-server-to-serverless-edge-migration',
    'Transform your legacy VPS / monolith backend into a modern serverless edge architecture on Cloudflare Workers and D1/Hyperdrive. Achieve sub-50ms latency worldwide while eliminating server maintenance.',
    'SERVICE',
    135000,
    160000,
    'PORT-CLD-EDGEMIG',
    0,
    6,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":3,"techStack":"Cloudflare Workers, D1, TypeScript, Wrangler, GitHub Actions CI/CD","revisions":2,"deliverables":"Zero-Downtime Data Migration, Edge Worker Codebase, Automated Deploy Pipelines, Benchmark Performance Report"}',
    unixepoch(),
    unixepoch()
  ),
  (
    'item-port-dev-mentorship-monthly',
    'tenant-demo-portfolio-09',
    'cat-port-dev-mentorship',
    '1-on-1 Senior Engineer Mentorship & System Design Coaching',
    'senior-engineer-mentorship-system-design-coaching',
    'Dedicated monthly 1-on-1 mentorship program for junior and mid-level software engineers aspiring to Staff / Principal engineering roles. Includes weekly 60-min deep dives, code reviews, career pathing, and mock system design interviews.',
    'SERVICE',
    25000,
    32000,
    'PORT-MNT-COACH',
    0,
    8,
    'PUBLISHED',
    '[]',
    '{"deliveryWeeks":4,"techStack":"System Design, Distributed Systems, TypeScript/Go, Career Strategy","revisions":1,"deliverables":"4 x 60-min Video Coaching Sessions, Async PR Code Reviews, Curated Study Roadmap, System Design Cheatsheets"}',
    unixepoch(),
    unixepoch()
  );
