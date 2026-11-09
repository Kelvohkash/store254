#!/usr/bin/env node
/**
 * Store254 Universal Storefront Template & Automatic Color Harmony Generator
 *
 * Generates self-contained storefront themes under `frontend/templates/<id>/`
 * (`template.css` + `preview.html`) and updates `frontend/templates/catalog.json`.
 *
 * Every generated template is 100% driven by automatic CSS color variables:
 *   --store-primary, --store-primary-hover, --store-primary-subtle, --store-primary-ink,
 *   --store-on-primary, --store-paper, --store-white, --store-surface-subtle,
 *   --store-ink, --store-muted, --store-line, --store-media-bg
 * so any foreground + background color pair (even dark+dark or light+light)
 * maintains guaranteed WCAG AA/AAA visibility across every business type.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PALETTES = [
  { id: "trust-forest", name: "Forest", primary: "#15803d", background: "#edf5ee" },
  { id: "sapphire-blue", name: "Ocean", primary: "#08718b", background: "#e9f2f9" },
  { id: "organic-sage", name: "Sage", primary: "#66835c", background: "#f1f4eb" },
  { id: "modern-onyx", name: "Charcoal", primary: "#334155", background: "#edf0f3" },
  { id: "sunset-amber", name: "Amber", primary: "#c46a2d", background: "#fbf0e5" },
  { id: "rose", name: "Rose", primary: "#b64269", background: "#f8edf1" },
  { id: "berry-blossom", name: "Blossom", primary: "#db2777", background: "#fdf2f8" },
  { id: "midnight-gold", name: "Midnight", primary: "#f59e0b", background: "#0f172a" },
  { id: "obsidian-emerald", name: "Obsidian", primary: "#10b981", background: "#111827" },
  { id: "royal-velvet", name: "Velvet", primary: "#a855f7", background: "#18122b" },
  { id: "terracotta-sand", name: "Terracotta", primary: "#c2410c", background: "#fdf6ee" },
];

export const TEMPLATE_BLUEPRINTS = [
  {
    id: "market-modern",
    name: "Market Modern",
    mood: "Professional & Everyday Retail",
    description: "Clean, confident everyday shopping with a balanced split hero, search-first header, and elevated cards.",
    previewImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#15803d", bg: "#edf5ee" },
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "modern",
      kicker: "MADE FOR EVERY DAY",
      cta: "Explore collection",
      title: "Good things,<br>chosen well.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1rem",
      buttonRadius: "0.75rem",
      pillRadius: "9999px",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "surface-glass",
      sidebarStyle: "modern-retail",
      cardVariant: "elevated",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.15rem",
    },
    sampleFilters: {
      title: "Aisle & Category",
      categories: ["Everyday Home 🏠", "Fresh Pantry & Coffee ☕", "Tech Essentials 🔌", "Lifestyle & Travel ✈️"],
      attributeName: "Merchant Trust",
      attributes: ["Verified Merchant ✓", "Instant M-Pesa STK", "Same-Day Dispatch", "Free Returns"],
    },
    sampleProducts: [
      { name: "Organic Arabica Single-Origin Coffee Beans", price: "KES 1,200", tag: "★ 4.9 (128)", color: "#78350f" },
      { name: "Minimalist Stainless Steel Insulated Flask", price: "KES 1,850", tag: "★ 4.8 (94)", color: "#1e293b" },
      { name: "Durable Reinforced Canvas Daypack", price: "KES 3,400", tag: "★ 5.0 (62)", color: "#334155" },
      { name: "Organic Soy Wax Candle in Amber Jar", price: "KES 1,400", tag: "★ 4.9 (87)", color: "#d97706" },
    ],
  },
  {
    id: "editorial-boutique",
    name: "Editorial Boutique",
    mood: "Tasteful & Poetic Fashion",
    description: "A considered fashion and lifestyle lookbook with serif typography, generous whitespace, and portrait frames.",
    previewImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#8c583a", bg: "#faf6f0" },
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "editorial",
      kicker: "A CONSIDERED EDIT",
      cta: "Discover the edit",
      title: "A little more<br>beautiful, every day.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", "Times New Roman", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.2rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "4 / 5",
      heroAlign: "left",
      headerStyle: "centered-editorial",
      sidebarStyle: "lookbook-index",
      cardVariant: "borderless-lookbook",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.5rem",
    },
    sampleFilters: {
      title: "The Edit Index",
      categories: ["Considered Apparel", "Living & Objects", "Fine Ceramic Works", "Aromatics & Tea"],
      attributeName: "Material Craft",
      attributes: ["Organic Belgian Linen", "Hand-Thrown Stoneware", "Natural Vegetable Dye", "Recycled Mulberry Silk"],
    },
    sampleProducts: [
      { name: "Draped Pure Linen Wrap Shirt", price: "KES 6,800", tag: "Pure Linen", color: "#d5bdaf" },
      { name: "Hand-Thrown Earthen Tea Bowl", price: "KES 2,200", tag: "Studio Ceramic", color: "#a89f91" },
      { name: "Cold-Pressed Cedar & Amber Oil", price: "KES 3,400", tag: "Small Batch", color: "#b08968" },
      { name: "Organic Cotton Canvas Market Bag", price: "KES 2,800", tag: "The Edit", color: "#ccd5ae" },
    ],
  },
  {
    id: "fashion-beauty-cosmetics",
    name: "Fashion, Beauty and Cosmetics",
    mood: "Glamorous & Photo-Led",
    description: "A photo-led fashion storefront with a bold brand ribbon, secondary category bar, and editorial runway cards.",
    previewImage: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#08718b", bg: "#f4f8fa" },
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "editorial",
      kicker: "THE NEW SEASON",
      cta: "Discover the edit",
      title: "Everyday,<br>considered.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", "Times New Roman", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.35rem",
      buttonRadius: "0.35rem",
      pillRadius: "0.35rem",
      mediaRatio: "4 / 5",
      heroAlign: "left",
      headerStyle: "primary-solid-ribbon",
      sidebarStyle: "runway-studio",
      cardVariant: "sharp-runway",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.25rem",
    },
    sampleFilters: {
      title: "Beauty Studio",
      categories: ["Skincare & Serums ✨", "Velvet Lip & Color 💄", "Artisanal Fragrance 🌸", "Body Glow & Bronze ☀️"],
      attributeName: "Formula Guarantee",
      attributes: ["Hyaluronic & Niacinamide", "Clean & Vegan Certified", "Waterproof Long-Wear", "Dermatologist Tested"],
    },
    sampleProducts: [
      { name: "Illuminating Peptide Glow Serum (30ml)", price: "KES 3,600", tag: "All-Day Radiance", color: "#f472b6" },
      { name: "Matte Velvet Lip Color in Spiced Rose", price: "KES 1,850", tag: "Hydrating Matte", color: "#be185d" },
      { name: "Solar Amber & Bergamot Eau de Parfum", price: "KES 8,500", tag: "50ml Reserve", color: "#eab308" },
      { name: "Golden Shimmer Body Nectar Oil", price: "KES 2,900", tag: "Natural Glow", color: "#fb923c" },
    ],
  },
  {
    id: "cute-boutique",
    name: "Sweet & Cute Boutique",
    mood: "Cute, Playful & Charming",
    description: "Bubbly pill frames, floating pastel halos, and bouncy interactions for gifts, stationery, baby care, and treats.",
    previewImage: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#db2777", bg: "#fdf2f8" },
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "minimal",
      font: "rounded",
      kicker: "MADE WITH LOVE & SPARKLE",
      cta: "Shop cute finds",
      title: "Little things<br>that make you smile.",
    },
    tokens: {
      fontHeading: '"DM Sans", ui-rounded, system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.6rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "1 / 1",
      heroAlign: "center",
      headerStyle: "floating-pill",
      sidebarStyle: "bubbly-pastel",
      cardVariant: "cute-bubbly",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.35rem",
    },
    sampleFilters: {
      title: "✨ Sweet Filters 💕",
      categories: ["Plushies & Toys 💕", "Pastel Stationery 🌸", "Sweet Room Decor ✨", "Gifts & Treats 🎀"],
      attributeName: "Magic Vibes",
      attributes: ["Extra Sparkle ✨", "Pastel Cloud Dreams ☁️", "Handmade with Love 💕", "Cute & Pocket Sized 🧸"],
    },
    sampleProducts: [
      { name: "Fluffy Strawberry Bunny Plush", price: "KES 1,850", tag: "Best Seller 💕", color: "#f472b6" },
      { name: "Pastel Cloud Ceramic Mug", price: "KES 950", tag: "Sweet Find 🌸", color: "#c084fc" },
      { name: "Sparkle Heart Linen Journal", price: "KES 1,200", tag: "New ✨", color: "#fb7185" },
      { name: "Boba Milk Tea Keychain Charm", price: "KES 450", tag: "Cute 🎀", color: "#fb923c" },
    ],
  },
  {
    id: "food-local",
    name: "Food & Local",
    mood: "Tasty, Warm & Appetizing",
    description: "Warm culinary canopy header, kitchen specials board, and delicious dish cards for bakeries, kitchens, and produce.",
    previewImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#c2410c", bg: "#fff7ed" },
    defaults: {
      archetype: "modern-retailer",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "editorial",
      kicker: "HOT DISHES & LOCAL FLAVOURS",
      cta: "Order takeaway",
      title: "Taste the heart<br>of local cooking.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.25rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "4 / 3",
      heroAlign: "left",
      headerStyle: "warm-canopy",
      sidebarStyle: "chalkboard-menu",
      cardVariant: "tasty-menu",
      gridColumnsDesktop: "repeat(3, minmax(0, 1fr))",
      gridGap: "1.35rem",
    },
    sampleFilters: {
      title: "👨‍🍳 Kitchen Menu & Specials",
      categories: ["Hot Main Dishes 🍲", "Biryani & Pilau Pots 🍚", "Fresh Juices & Zobo 🍹", "Bakery & Swahili Bites 🥐"],
      attributeName: "Dietary & Spice",
      attributes: ["Chef's Daily Special 👨‍🍳", "Mild Herb Flavor 🌿", "Extra Swahili Spice 🌶️", "100% Vegetarian 🥗"],
    },
    sampleProducts: [
      { name: "Swahili Beef Biryani with Kachumbari", price: "KES 650", tag: "Chef Choice 🍲", color: "#c2410c" },
      { name: "Coconut Fish Curry & Fragrant Rice", price: "KES 850", tag: "Fresh Catch 🐟", color: "#ea580c" },
      { name: "Slow-Cooked Pilau Mbuzi Plate", price: "KES 700", tag: "Daily Special 🔥", color: "#b45309" },
      { name: "Fresh Chilled Hibiscus Zobo (500ml)", price: "KES 250", tag: "Ice Cold 🍹", color: "#be123c" },
    ],
  },
  {
    id: "tech-home",
    name: "Tech & Home",
    mood: "Crisp, Bento & Specification-Led",
    description: "Bento spec cards, technical hardware chips, and tabular pricing for consumer electronics and modern gear.",
    previewImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#0284c7", bg: "#f0f6fa" },
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "modern",
      kicker: "NEXT-GEN HARDWARE",
      cta: "Compare specs",
      title: "Audio, display &<br>smart living.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.85rem",
      buttonRadius: "0.5rem",
      pillRadius: "0.45rem",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "bento-tech",
      sidebarStyle: "bento-control",
      cardVariant: "bento-spec",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.15rem",
    },
    sampleFilters: {
      title: "SYSTEM SPECIFICATIONS",
      categories: ["Audio & ANC 🎧", "Monitors & 4K 🖥️", "Fast Power & GaN ⚡", "Desk Ergonomics 🖱️"],
      attributeName: "Connectivity Protocol",
      attributes: ["USB-C Thunderbolt 4", "Bluetooth 5.3 Low-Latency", "MagSafe Fast Induction", "Wi-Fi 6E Ready"],
    },
    sampleProducts: [
      { name: "Pro Studio ANC Wireless Headphones (40H)", price: "KES 14,500", tag: "40H Battery", color: "#0284c7" },
      { name: "Ultra-Wide 4K IPS Ergonomic Monitor 27\"", price: "KES 42,000", tag: "120Hz · 4K HDR", color: "#334155" },
      { name: "100W GaN 4-Port Fast Desktop Charger", price: "KES 4,800", tag: "100W Fast GaN", color: "#0ea5e9" },
      { name: "Mechanical Low-Profile Keyboard (RGB)", price: "KES 8,900", tag: "Hot-Swap Switch", color: "#475569" },
    ],
  },
  {
    id: "service-studio",
    name: "Service Studio",
    mood: "Architectural, Consultation & Booking",
    description: "Warm stone tones, consultation appointment cards, and session scheduling for agencies and studios.",
    previewImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#78350f", bg: "#fdf8f4" },
    defaults: {
      archetype: "service-portfolio",
      header: "minimal-nav",
      card: "service-card",
      hero: "minimal",
      font: "editorial",
      kicker: "SPACE TO CREATE & COLLABORATE",
      cta: "Book session",
      title: "Expertise, craft<br>& guidance.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.15rem",
      buttonRadius: "0.5rem",
      pillRadius: "9999px",
      mediaRatio: "4 / 3",
      heroAlign: "center",
      headerStyle: "surface-glass",
      sidebarStyle: "service-agenda",
      cardVariant: "service-accent-top",
      gridColumnsDesktop: "repeat(3, minmax(0, 1fr))",
      gridGap: "1.35rem",
    },
    sampleFilters: {
      title: "Studio Services",
      categories: ["Creative Direction 🎨", "Photography & Studio 📸", "Brand Strategy 💡", "Intensive Workshops 👥"],
      attributeName: "Session Duration",
      attributes: ["30 Min Discovery Call", "60 Min Deep Dive Video", "Half-Day On-Site Hire", "Full Project Package"],
    },
    sampleProducts: [
      { name: "Comprehensive Brand Audit & Strategy", price: "KES 12,000", tag: "60 Min Session", color: "#78350f" },
      { name: "Commercial Photography Studio Hire", price: "KES 24,000", tag: "Half-Day Hire", color: "#92400e" },
      { name: "UX Design Sprint & Product Review", price: "KES 35,000", tag: "Full Package", color: "#451a03" },
      { name: "1-on-1 Creative Direction Advisory", price: "KES 7,500", tag: "30 Min Online", color: "#b45309" },
    ],
  },
  {
    id: "premium-maker",
    name: "Premium Maker",
    mood: "Artisan Leather, Timber & Heritage",
    description: "Deep heritage tones, artisan seal mark, and workshop craft cards for hand-stitched leather and timber.",
    previewImage: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#b45309", bg: "#fef8ee" },
    defaults: {
      archetype: "single-product-maker",
      header: "centered-brand",
      card: "grid-card",
      hero: "editorial",
      font: "editorial",
      kicker: "HANDCRAFTED IN NAIROBI",
      cta: "Explore workshop",
      title: "Patience, weight<br>& lasting form.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", "Times New Roman", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1rem",
      buttonRadius: "0.5rem",
      pillRadius: "0.45rem",
      mediaRatio: "4 / 5",
      heroAlign: "left",
      headerStyle: "surface-glass",
      sidebarStyle: "workshop-craft",
      cardVariant: "horizontal-showcase",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.25rem",
    },
    sampleFilters: {
      title: "Workshop Disciplines",
      categories: ["Hand-Stitched Leather 🧳", "Hand-Turned Hardwood 🪵", "Solid Cast Brass ⚓", "Heavy Canvas Goods 🎒"],
      attributeName: "Material Provenance",
      attributes: ["Full-Grain Kenyan Cowhide", "Upcycled Kenyan Olive Wood", "Solid Sand-Cast Brass", "Lifetime Repair Warranty"],
    },
    sampleProducts: [
      { name: "Full-Grain Leather Weekender Duffle", price: "KES 18,500", tag: "Lifetime Leather", color: "#78350f" },
      { name: "Upcycled Olive Wood Serving Platter", price: "KES 4,200", tag: "Hand-Carved", color: "#b45309" },
      { name: "Heavyweight Waxed Canvas Backpack", price: "KES 11,000", tag: "Weatherproof", color: "#451a03" },
      { name: "Solid Cast Brass Pocket Compass", price: "KES 3,800", tag: "Cast Brass", color: "#92400e" },
    ],
  },
  {
    id: "luxury-atelier",
    name: "Luxury Atelier",
    mood: "Understated, Quiet Luxury & Noir",
    description: "Museum-grade minimalist gallery, hairline borders, and serif typography for haute fashion and fine jewelry.",
    previewImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#52525b", bg: "#fafaf9" },
    defaults: {
      archetype: "lifestyle-boutique",
      header: "centered-brand",
      card: "grid-card",
      hero: "minimal",
      font: "editorial",
      kicker: "PRIVATE COLLECTION",
      cta: "Enter the gallery",
      title: "Timeless craft,<br>quiet luxury.",
    },
    tokens: {
      fontHeading: 'Georgia, "Playfair Display", serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "0.25rem",
      buttonRadius: "0.2rem",
      pillRadius: "0.2rem",
      mediaRatio: "4 / 5",
      heroAlign: "center",
      headerStyle: "minimal-atelier",
      sidebarStyle: "hairline-atelier",
      cardVariant: "hairline-gallery",
      gridColumnsDesktop: "repeat(3, minmax(0, 1fr))",
      gridGap: "1.85rem",
    },
    sampleFilters: {
      title: "ATELIER CURATION",
      categories: ["Haute Ready-to-Wear", "Handcrafted Fine Jewelry", "Architectural Living Objects", "Numbered Editions"],
      attributeName: "Material Standard",
      attributes: ["Pure Mulberry Silk", "18k Solid Gold Fill", "Hand-Polished Black Onyx", "Natural Earthen Glaze"],
    },
    sampleProducts: [
      { name: "Hand-Woven Silk Kimono Robe", price: "KES 18,500", tag: "No. 07 / 20", color: "#27272a" },
      { name: "Sculptural Brass Vessel & Base", price: "KES 12,000", tag: "One of a Kind", color: "#d4af37" },
      { name: "Onyx Pendant in 18k Gold Fill", price: "KES 9,800", tag: "Atelier Made", color: "#18181b" },
      { name: "Minimalist Tailored Wool Trench", price: "KES 26,000", tag: "Private Order", color: "#3f3f46" },
    ],
  },
  {
    id: "brutalist-studio",
    name: "Neo-Brutalist Studio",
    mood: "Bold, Edgy & Streetwear",
    description: "Bold architectural grid with crisp 3px ink borders, offset hard black shadows, and raw streetwear punch.",
    previewImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#dc2626", bg: "#fefce8" },
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "modern",
      kicker: "LIMITED EDITION ARCHIVE",
      cta: "Shop the drop",
      title: "Bold form.<br>Zero compromise.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", monospace, sans-serif',
      cardRadius: "0px",
      buttonRadius: "0px",
      pillRadius: "0px",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "brutalist-framed",
      sidebarStyle: "raw-brutalist",
      cardVariant: "brutalist-shadow",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1.25rem",
    },
    sampleFilters: {
      title: "[SYS // ARCHIVE FILTER]",
      categories: ["[HEAVY FLEECE]", "[CARGO PANTS V2]", "[HEADWEAR]", "[HARDWARE // ACCESSORIES]"],
      attributeName: "DROP STATUS",
      attributes: ["DROP 04 // LIVE", "DEADSTOCK VAULT", "PROTOTYPE SAMPLE", "WORLDWIDE DISPATCH"],
    },
    sampleProducts: [
      { name: "HEAVY 450GSM OVERSIZED HOODIE", price: "KES 4,800", tag: "[LOW STOCK]", color: "#dc2626" },
      { name: "UTILITY TACTICAL CARGO V2", price: "KES 5,500", tag: "[DROP 04]", color: "#18181b" },
      { name: "INDUSTRIAL EMBROIDERED DAD CAP", price: "KES 1,900", tag: "[RAW INK]", color: "#52525b" },
      { name: "REFLECTIVE KEYSTRAP & CLIP", price: "KES 950", tag: "[EDITION 01]", color: "#ef4444" },
    ],
  },
  {
    id: "bazaar-vibrant",
    name: "Dynamic Bazaar",
    mood: "Energetic & High-Conversion",
    description: "High-energy merchant marketplace with floating pill navigation, quick-buy badges, and dense discovery.",
    previewImage: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1100&q=85",
    defaultColors: { fg: "#d97706", bg: "#fffbeb" },
    defaults: {
      archetype: "modern-retailer",
      header: "compact-search-first",
      card: "grid-card",
      hero: "split",
      font: "rounded",
      kicker: "TOP DEALS & NEW FINDS",
      cta: "Browse deals",
      title: "Everything you need,<br>right here.",
    },
    tokens: {
      fontHeading: '"Manrope", system-ui, sans-serif',
      fontBody: '"DM Sans", system-ui, sans-serif',
      cardRadius: "1.1rem",
      buttonRadius: "9999px",
      pillRadius: "9999px",
      mediaRatio: "1 / 1",
      heroAlign: "left",
      headerStyle: "floating-pill",
      sidebarStyle: "bazaar-pop",
      cardVariant: "bazaar-pop",
      gridColumnsDesktop: "repeat(4, minmax(0, 1fr))",
      gridGap: "1rem",
    },
    sampleFilters: {
      title: "Bazaar Categories",
      categories: ["Artisanal Kiondo Totes 🧺", "Safari Leather Sandals 🩴", "Beaded Chokers & Cuffs ✨", "Pure Spices & Honey 🍯"],
      attributeName: "Flash Promotions",
      attributes: ["Same-Day Nairobi Delivery ⚡", "Buy 2 Get 1 Free 🔥", "Direct from Artisan 🇰🇪", "Free Gift Included 🎁"],
    },
    sampleProducts: [
      { name: "Hand-Woven Sisal & Leather Kiondo Tote", price: "KES 2,600", tag: "Direct Maker", color: "#d97706" },
      { name: "Traditional Maasai Beaded Choker & Cuff", price: "KES 1,800", tag: "Hand-Beaded", color: "#ea580c" },
      { name: "Genuine Leather Safari Gladiator Sandals", price: "KES 2,950", tag: "Pure Leather", color: "#b45309" },
      { name: "Pure Coastal Turmeric & Ginger Blend (250g)", price: "KES 650", tag: "Fresh Harvest", color: "#f59e0b" },
    ],
  },
];

function generateTemplateCss(template) {
  const { id, name, mood, tokens } = template;
  const scope = `html[data-storefront="true"][data-storefront-template="${id}"]`;
  const standaloneScope = `html[data-storefront-template="${id}"]`;

  // 1. BESPOKE HEADER CSS
  let headerCss = "";
  if (tokens.headerStyle === "floating-pill") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  margin: 0.75rem auto;
  max-width: min(96%, 82rem);
  border: 2px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  border-radius: 9999px !important;
  background: color-mix(in srgb, var(--store-white) 94%, transparent) !important;
  box-shadow: 0 12px 36px -8px var(--store-primary-glow, rgba(15, 23, 42, 0.08)) !important;
  backdrop-filter: blur(16px);
}
${scope} .site-header::before { display: none; }
${scope} .header-action,
${standaloneScope} #header-actions-nav button {
  border-radius: 9999px !important;
  background: color-mix(in srgb, var(--store-primary) 8%, var(--store-white)) !important;
  border: 1px solid color-mix(in srgb, var(--store-primary) 22%, var(--store-line)) !important;
  color: var(--store-ink) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-radius: 9999px !important;
}`;
  } else if (tokens.headerStyle === "warm-canopy") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 92%, var(--store-primary-subtle)) !important;
  border-top: 5px solid var(--store-primary) !important;
  border-bottom: 2px dashed color-mix(in srgb, var(--store-primary) 35%, var(--store-line)) !important;
  box-shadow: 0 4px 18px rgba(154, 52, 18, 0.06) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 700 !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-radius: 9999px !important;
}`;
  } else if (tokens.headerStyle === "minimal-atelier") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-paper) !important;
  border-top: 0 !important;
  border-bottom: 1px solid var(--store-line) !important;
  box-shadow: none !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  font-size: 1.25rem !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase;
  color: var(--store-ink) !important;
}
${scope} .header-action,
${scope} #desktop-cart-btn,
${standaloneScope} #header-actions-nav button {
  border-radius: 0.2rem !important;
  border: 1px solid var(--store-line) !important;
  background: transparent !important;
  color: var(--store-ink) !important;
}`;
  } else if (tokens.headerStyle === "brutalist-framed") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
  border-top: 0 !important;
  border-bottom: 3.5px solid var(--store-ink) !important;
  box-shadow: none !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-weight: 950 !important;
  letter-spacing: -0.04em !important;
  text-transform: uppercase;
}
${scope} .header-action,
${scope} .cart-action,
${scope} #desktop-cart-btn,
${standaloneScope} #header-actions-nav button {
  border-radius: 0px !important;
  border: 2.5px solid var(--store-ink) !important;
  box-shadow: 3.5px 3.5px 0 var(--store-ink) !important;
  text-transform: uppercase;
  font-weight: 900 !important;
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
}
${scope} .search-field input,
${standaloneScope} #search-input {
  border: 2.5px solid var(--store-ink) !important;
  border-radius: 0 !important;
  font-family: ui-monospace, monospace !important;
}`;
  } else if (tokens.headerStyle === "primary-solid-ribbon") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  position: sticky;
  top: 0;
  background: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--store-on-primary) 18%, var(--store-primary)) !important;
  box-shadow: 0 10px 28px var(--store-primary-glow) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  color: var(--store-on-primary) !important;
}
${scope} .header-action,
${standaloneScope} #header-actions-nav button {
  border-radius: 9999px !important;
  border: 1px solid color-mix(in srgb, var(--store-on-primary) 32%, transparent) !important;
  background: color-mix(in srgb, var(--store-on-primary) 12%, transparent) !important;
  color: var(--store-on-primary) !important;
}
${scope} #desktop-cart-btn,
${standaloneScope} #desktop-cart-btn {
  background: var(--store-white) !important;
  color: var(--store-ink) !important;
}`;
  } else if (tokens.headerStyle === "bento-tech") {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: var(--store-white) !important;
  border-top: 3.5px solid var(--store-primary) !important;
  border-bottom: 1px solid var(--store-line) !important;
}
${scope} .site-header::before { display: none; }
${scope} #header-store-name,
${standaloneScope} #header-store-name {
  font-family: ${tokens.fontHeading} !important;
  letter-spacing: -0.04em !important;
}`;
  } else {
    headerCss = `
${scope} .site-header,
${standaloneScope} #site-header {
  background: color-mix(in srgb, var(--store-white) 94%, var(--store-paper)) !important;
  border-bottom: 1px solid var(--store-line) !important;
}`;
  }

  // 2. BESPOKE FILTER SIDEBAR CSS
  let sidebarCss = "";
  if (tokens.sidebarStyle === "bubbly-pastel") {
    sidebarCss = `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 2px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  border-radius: 1.8rem !important;
  background: linear-gradient(180deg, color-mix(in srgb, var(--store-primary) 6%, #ffffff), #ffffff) !important;
  box-shadow: 0 14px 34px -8px var(--store-primary-glow, rgba(244, 114, 182, 0.15)) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  color: var(--store-primary) !important;
  font-family: ${tokens.fontHeading} !important;
  font-weight: 850 !important;
  letter-spacing: 0.02em !important;
}
${scope} #desktop-filter-sidebar input[type="range"] {
  accent-color: var(--store-primary) !important;
}`;
  } else if (tokens.sidebarStyle === "chalkboard-menu") {
    sidebarCss = `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 2px dashed color-mix(in srgb, var(--store-primary) 42%, var(--store-line)) !important;
  border-radius: 1.35rem !important;
  background: color-mix(in srgb, var(--store-paper) 85%, var(--store-primary-subtle)) !important;
  box-shadow: 0 8px 24px rgba(154, 52, 18, 0.08) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  color: var(--store-primary) !important;
  font-family: ${tokens.fontHeading} !important;
  font-weight: 750 !important;
}`;
  } else if (tokens.sidebarStyle === "hairline-atelier") {
    sidebarCss = `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1px solid var(--store-line) !important;
  border-radius: 0.25rem !important;
  border-top: 2px solid var(--store-primary) !important;
  background: var(--store-paper) !important;
  box-shadow: none !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase;
  font-size: 0.72rem !important;
  color: var(--store-ink) !important;
}`;
  } else if (tokens.sidebarStyle === "raw-brutalist") {
    sidebarCss = `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 3px solid var(--store-ink) !important;
  border-radius: 0px !important;
  background: var(--store-white) !important;
  box-shadow: 6px 6px 0 var(--store-ink) !important;
  padding: 1.5rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ui-monospace, monospace !important;
  font-size: 0.8rem !important;
  font-weight: 950 !important;
  text-transform: uppercase;
  color: var(--store-ink) !important;
}
${scope} #desktop-filter-sidebar input[type="range"] {
  accent-color: var(--store-primary) !important;
}`;
  } else if (tokens.sidebarStyle === "bento-control") {
    sidebarCss = `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1.5px solid var(--store-line) !important;
  border-radius: 0.85rem !important;
  border-top: 3.5px solid var(--store-primary) !important;
  background: var(--store-white) !important;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05) !important;
  padding: 1.4rem !important;
}
${scope} #desktop-filter-sidebar h3,
${standaloneScope} #desktop-filter-sidebar h4 {
  font-family: ${tokens.fontHeading} !important;
  font-size: 0.74rem !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase;
}`;
  } else {
    sidebarCss = `
${scope} #desktop-filter-sidebar,
${standaloneScope} #desktop-filter-sidebar {
  border: 1px solid var(--store-line) !important;
  border-top: 3px solid var(--store-primary) !important;
  border-radius: var(--store-card-radius) !important;
  background: var(--store-white) !important;
  box-shadow: var(--store-card-shadow, 0 4px 18px rgba(0,0,0,0.04)) !important;
  padding: 1.4rem !important;
}`;
  }

  // 3. BESPOKE CARD CSS
  let cardCss = "";
  if (tokens.cardVariant === "cute-bubbly") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 2px solid color-mix(in srgb, var(--store-primary) 28%, var(--store-line)) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 10px 0 -2px color-mix(in srgb, var(--store-primary) 20%, var(--store-line)), 0 16px 32px -8px var(--store-primary-glow) !important;
  transition: transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 240ms ease !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translateY(-5px) rotate(-0.5deg) !important;
  box-shadow: 0 14px 0 -2px color-mix(in srgb, var(--store-primary) 30%, var(--store-line)), 0 22px 38px -8px var(--store-primary-glow) !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  margin: 0.6rem 0.6rem 0 !important;
  width: calc(100% - 1.2rem) !important;
  border-radius: calc(${tokens.cardRadius} - 0.45rem) !important;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: 9999px !important;
  box-shadow: 0 6px 18px rgba(219, 39, 119, 0.3) !important;
}`;
  } else if (tokens.cardVariant === "tasty-menu") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1.5px solid color-mix(in srgb, var(--store-primary) 24%, var(--store-line)) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 12px 30px -10px rgba(154, 52, 18, 0.1) !important;
}
${scope} .product-card-footer,
${standaloneScope} .product-card-actions {
  border-top: 1.5px dashed color-mix(in srgb, var(--store-primary) 32%, var(--store-line)) !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  display: inline-block;
  padding: 0.18rem 0.65rem;
  border-radius: 9999px;
  background: var(--store-primary-subtle);
  color: var(--store-primary) !important;
  font-weight: 850;
}`;
  } else if (tokens.cardVariant === "brutalist-shadow") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 2.5px solid var(--store-ink) !important;
  border-radius: 0px !important;
  background: var(--store-white) !important;
  box-shadow: 5px 5px 0 var(--store-ink) !important;
  transition: transform 160ms ease, box-shadow 160ms ease !important;
}
${scope} #storefront-view .product-card:hover,
${standaloneScope} .product-card:hover {
  transform: translate(-3px, -3px) !important;
  box-shadow: 8px 8px 0 var(--store-primary) !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  text-transform: uppercase;
  font-weight: 900 !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-family: ui-monospace, monospace !important;
  color: var(--store-primary) !important;
  font-weight: 900 !important;
}
${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  border-radius: 0 !important;
  border: 2px solid var(--store-ink) !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 var(--store-ink) !important;
}`;
  } else if (tokens.cardVariant === "hairline-gallery") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: none !important;
}
${scope} .product-card-title,
${standaloneScope} .product-title {
  font-family: ${tokens.fontHeading} !important;
  font-weight: 500 !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  color: var(--store-primary) !important;
  font-family: ${tokens.fontHeading} !important;
}`;
  } else if (tokens.cardVariant === "bento-spec") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1.5px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04) !important;
}
${scope} .product-card-price,
${standaloneScope} .product-price {
  font-variant-numeric: tabular-nums;
  color: var(--store-primary) !important;
  font-weight: 850;
}`;
  } else if (tokens.cardVariant === "borderless-lookbook") {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio} !important;
  border-radius: ${tokens.cardRadius} !important;
  border: 1px solid var(--store-line) !important;
}`;
  } else {
    cardCss = `
${scope} #storefront-view .product-card,
${standaloneScope} .product-card {
  border: 1px solid var(--store-line) !important;
  border-radius: ${tokens.cardRadius} !important;
  background: var(--store-white) !important;
  box-shadow: var(--store-card-shadow, 0 8px 26px rgba(15, 23, 42, 0.06)) !important;
}`;
  }

  return `/* ==========================================================================
   Store254 Generated Storefront Theme: ${name} (${id})
   Mood: ${mood}
   Auto-generated by frontend/templates/generate-templates.mjs
   100% Contrast-Safe & Automatic Foreground/Background Color Adaptation
   ========================================================================== */

${scope},
${standaloneScope} {
  --store-card-radius: ${tokens.cardRadius};
  --store-btn-radius: ${tokens.buttonRadius};
  --store-pill-radius: ${tokens.pillRadius};
  --store-font-heading: ${tokens.fontHeading};
  --store-font-body: ${tokens.fontBody};
  background-color: var(--store-paper);
  color: var(--store-ink);
  font-family: var(--store-font-body);
}

${standaloneScope} body {
  margin: 0;
  background-color: var(--store-paper) !important;
  color: var(--store-ink) !important;
  font-family: var(--store-font-body) !important;
  line-height: 1.55;
}

${standaloneScope} #site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem clamp(1rem, 4vw, 3rem);
}

${standaloneScope} #header-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

${standaloneScope} #header-store-name {
  margin: 0;
  font-family: var(--store-font-heading);
  font-size: 1.15rem;
  color: var(--store-ink);
}

${standaloneScope} #header-store-tagline,
${standaloneScope} #header-powered-by {
  margin: 0;
  font-size: 0.72rem;
  color: var(--store-muted);
}

${standaloneScope} #search-form {
  display: flex;
  flex: 1 1 18rem;
  max-width: 32rem;
  align-items: center;
  gap: 0.4rem;
}

${standaloneScope} input[type="search"],
${standaloneScope} input[type="text"],
${standaloneScope} select {
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--store-line);
  border-radius: var(--store-btn-radius);
  background-color: var(--store-white);
  color: var(--store-ink);
  font: inherit;
}

${standaloneScope} #search-input {
  flex: 1;
}

${standaloneScope} #header-actions-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

${standaloneScope} button,
${standaloneScope} #storefront-primary-cta,
${standaloneScope} #banner-store-call-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 1.05rem;
  border-radius: var(--store-btn-radius);
  border: 1px solid var(--store-line);
  background-color: var(--store-white);
  color: var(--store-ink);
  font-weight: 700;
  font-size: 0.82rem;
  text-decoration: none;
  cursor: pointer;
  transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

${standaloneScope} button:hover,
${standaloneScope} #storefront-primary-cta:hover {
  transform: translateY(-1px);
}

${standaloneScope} #desktop-cart-btn,
${standaloneScope} .add-to-cart-btn,
${standaloneScope} #storefront-primary-cta {
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-color: var(--store-primary) !important;
}

/* Header Variant Styling */
${headerCss}

/* Hero Banner Styling */
${scope} .store-banner,
${standaloneScope} #store-info-banner {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--store-line);
  background: radial-gradient(
      circle at 86% 20%,
      color-mix(in srgb, var(--store-primary) 22%, transparent) 0%,
      transparent 42%
    ),
    linear-gradient(
      130deg,
      color-mix(in srgb, var(--store-primary) 14%, var(--store-paper)) 0%,
      var(--store-paper) 58%,
      color-mix(in srgb, var(--store-primary) 8%, var(--store-white)) 100%
    ) !important;
  color: var(--store-ink) !important;
  padding: clamp(2.2rem, 5vw, 4.25rem) clamp(1rem, 4vw, 3rem);
  text-align: ${tokens.heroAlign};
}

${scope} .store-banner h1,
${standaloneScope} #banner-store-name {
  font-family: var(--store-font-heading) !important;
  color: var(--store-ink) !important;
  font-size: clamp(2.2rem, 4.5vw, 3.85rem) !important;
  line-height: 1.06 !important;
  margin: 0.4rem 0 0.8rem;
}

${scope} .store-banner #banner-store-desc,
${standaloneScope} #banner-store-desc {
  color: var(--store-muted) !important;
  max-width: 42rem;
  font-size: 1rem;
  ${tokens.heroAlign === "center" ? "margin-inline: auto;" : ""}
}

${scope} .store-banner .store-address,
${scope} .store-banner .store-tagline,
${standaloneScope} #banner-store-subdomain,
${standaloneScope} #banner-store-tagline {
  display: inline-block;
  padding: 0.28rem 0.75rem;
  border-radius: var(--store-pill-radius);
  background: color-mix(in srgb, var(--store-primary) 14%, var(--store-white));
  color: var(--store-primary) !important;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.72rem;
}

${scope} .storefront-primary-cta,
${standaloneScope} #storefront-primary-cta {
  margin-top: 1rem;
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-color: var(--store-primary) !important;
}

/* Category Navigation Bar */
${standaloneScope} #storefront-category-nav {
  padding: 0.85rem clamp(1rem, 4vw, 3rem);
  border-bottom: 1px solid var(--store-line);
  background: var(--store-white);
  overflow-x: auto;
}

${standaloneScope} #category-pills {
  display: flex;
  gap: 0.5rem;
}

${scope} .category-pill,
${standaloneScope} #category-pills button {
  border-radius: var(--store-pill-radius) !important;
}

${standaloneScope} #category-pills button[aria-selected="true"] {
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
  border-color: var(--store-primary) !important;
}

/* Catalog Layout */
${standaloneScope} #storefront-view {
  max-width: 86rem;
  margin: 0 auto;
  padding: 2.2rem clamp(1rem, 4vw, 3rem);
}

${standaloneScope} #catalog-layout {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

/* Bespoke Filter Sidebar */
${sidebarCss}

${standaloneScope} #desktop-filter-sidebar fieldset {
  border: 0;
  border-top: 1px solid var(--store-line);
  padding: 1rem 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

${standaloneScope} #desktop-filter-sidebar legend {
  font-weight: 800;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--store-ink);
  padding-bottom: 0.35rem;
}

/* Items Grid */
${scope} #items-grid,
${standaloneScope} #items-grid {
  display: grid;
  grid-template-columns: ${tokens.gridColumnsDesktop};
  gap: ${tokens.gridGap};
}

${scope} #items-grid .product-card-media,
${standaloneScope} .product-card-media {
  aspect-ratio: ${tokens.mediaRatio};
  background-color: var(--store-media-bg) !important;
  overflow: hidden;
  margin: 0;
  position: relative;
}

${standaloneScope} .product-card-body,
${standaloneScope} .product-card-actions {
  padding: 0.95rem 1.1rem;
}

${scope} .product-card-title,
${standaloneScope} .product-title {
  color: var(--store-ink) !important;
  font-family: var(--store-font-heading);
  margin: 0.25rem 0;
  font-size: 1rem;
}

${scope} .product-card-price,
${standaloneScope} .product-price {
  color: var(--store-ink) !important;
  font-weight: 850;
  font-size: 1.1rem;
}

${scope} .product-card-add,
${standaloneScope} .add-to-cart-btn {
  width: 100%;
  border-radius: var(--store-btn-radius) !important;
  background-color: var(--store-primary) !important;
  color: var(--store-on-primary) !important;
}

/* Bespoke Card Treatment */
${cardCss}

@media (max-width: 900px) {
  ${standaloneScope} #catalog-layout {
    grid-template-columns: 1fr;
  }
  ${scope} #items-grid,
  ${standaloneScope} #items-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;
}

function generatePreviewHtml(template) {
  const { id, name, mood, description, defaults, defaultColors, sampleFilters, sampleProducts } = template;
  const fgInit = defaultColors?.fg || "#15803d";
  const bgInit = defaultColors?.bg || "#edf5ee";
  const titleText = String(defaults.title || name).replace(/<br\s*\/?>/gi, " ");

  const filterCategories = sampleFilters?.categories || ["Featured Selection", "Express Delivery", "Customer Favorites", "Limited Edition"];
  const filterAttributes = sampleFilters?.attributes || ["Verified Authenticity", "Fast Shipping", "Money Back Guarantee"];
  const filterCatTitle = sampleFilters?.title || "Product Category";
  const filterAttrTitle = sampleFilters?.attributeName || "Filter Options";

  const products = sampleProducts || [
    { name: "Signature Studio Piece", price: "KES 4,500", tag: "Featured 01", color: "#15803d" },
    { name: "Curated Essential Edition", price: "KES 6,200", tag: "Featured 02", color: "#08718b" },
    { name: "Handpicked Studio Release", price: "KES 3,800", tag: "Featured 03", color: "#c46a2d" },
    { name: "Limited Workshop Archive", price: "KES 7,900", tag: "Featured 04", color: "#334155" },
  ];

  return `<!doctype html>
<html lang="en" data-storefront="true" data-storefront-template="${id}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} (${mood}) — Store254 Interactive Theme Preview</title>
  <link rel="stylesheet" href="./template.css">
  <style>
    * { box-sizing: border-box; }
    .preview-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: #0f172a;
      color: #f8fafc;
      font: 600 0.78rem system-ui, sans-serif;
      border-bottom: 1px solid #1e293b;
    }
    .preview-bar input[type="color"] {
      width: 1.9rem;
      height: 1.65rem;
      border: 1px solid #475569;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      vertical-align: middle;
    }
    .preview-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem; }
    .preview-preset-btn {
      padding: 0.35rem 0.65rem !important;
      border-radius: 999px !important;
      border: 1px solid #334155 !important;
      background: #1e293b !important;
      color: #e2e8f0 !important;
      font-size: 0.7rem !important;
      cursor: pointer;
    }
    .preview-preset-btn:hover { background: #334155 !important; }
    .preview-badge {
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      background: #064e3b;
      color: #6ee7b7;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .svg-illustration {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, color-mix(in srgb, var(--store-primary) 18%, var(--store-media-bg)), var(--store-media-bg));
      color: var(--store-primary);
      font-weight: 800;
      font-size: 0.82rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .product-tag-pill {
      display: inline-block;
      margin-bottom: 0.35rem;
      padding: 0.15rem 0.5rem;
      border-radius: var(--store-pill-radius);
      background: var(--store-primary-subtle);
      color: var(--store-primary);
      font-size: 0.65rem;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <div class="preview-bar">
    <div>
      <strong>${name}</strong> · <span style="color:#94a3b8">${mood}</span>
    </div>
    <div class="preview-controls">
      <label>Foreground <input type="color" id="fg-picker" value="${fgInit}"></label>
      <label>Background <input type="color" id="bg-picker" value="${bgInit}"></label>
      <button type="button" class="preview-preset-btn" onclick="setColors('${fgInit}','${bgInit}')">Theme Default</button>
      <button type="button" class="preview-preset-btn" onclick="setColors('#111827','#0f172a')">Test Dark+Dark</button>
      <button type="button" class="preview-preset-btn" onclick="setColors('#f8fafc','#ffffff')">Test Light+Light</button>
      <span id="contrast-status" class="preview-badge">WCAG Auto-Contrast Active</span>
    </div>
  </div>

  <header id="site-header">
    <div id="header-brand">
      <div id="header-store-identity">
        <h1 id="header-store-name">${name}</h1>
        <p id="header-store-tagline">${mood}</p>
      </div>
    </div>
    <form id="search-form" onsubmit="event.preventDefault()">
      <label for="search-input" style="display:none">Search</label>
      <input type="search" id="search-input" placeholder="Search ${name.toLowerCase()} catalog...">
    </form>
    <nav id="header-actions-nav">
      <button type="button">Profile</button>
      <button type="button">Wishlist (2)</button>
      <button type="button" id="desktop-cart-btn">Cart (3)</button>
    </nav>
  </header>

  <nav id="storefront-category-nav">
    <div id="category-pills">
      <button type="button" aria-selected="true">All Items</button>
      ${filterCategories.map(cat => `<button type="button" aria-selected="false">${cat}</button>`).join("\n      ")}
    </div>
  </nav>

  <section id="store-info-banner">
    <p id="banner-store-subdomain">${defaults.kicker}</p>
    <h2 id="banner-store-name">${titleText}</h2>
    <p id="banner-store-desc">${description}</p>
    <a id="storefront-primary-cta" href="#items-grid">${defaults.cta}</a>
  </section>

  <main id="storefront-view">
    <div id="catalog-layout">
      <aside id="desktop-filter-sidebar">
        <h4>${filterCatTitle}</h4>
        <fieldset>
          <legend>${filterCatTitle}</legend>
          ${filterCategories.map((cat, idx) => `<label><input type="checkbox"${idx === 0 ? " checked" : ""}> ${cat}</label>`).join("\n          ")}
        </fieldset>
        <fieldset>
          <legend>${filterAttrTitle}</legend>
          ${filterAttributes.map((attr, idx) => `<label><input type="checkbox"${idx < 2 ? " checked" : ""}> ${attr}</label>`).join("\n          ")}
        </fieldset>
      </aside>

      <section id="catalog-main-content">
        <div id="items-grid">
          ${products.map(p => `
          <article class="product-card">
            <figure class="product-card-media"><div class="svg-illustration">${p.tag}</div></figure>
            <div class="product-card-body">
              <span class="product-tag-pill">${p.tag}</span>
              <h5 class="product-title">${p.name}</h5>
              <span class="product-price">${p.price}</span>
            </div>
            <div class="product-card-actions">
              <button type="button" class="add-to-cart-btn">Add to Cart</button>
            </div>
          </article>
          `).join("")}
        </div>
      </section>
    </div>
  </main>

  <script>
    function hexToRgb(hex) {
      const clean = hex.replace("#", "");
      const full = clean.length === 3 ? [...clean].map(c => c + c).join("") : clean;
      return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    }
    function rgbToHex(r, g, b) {
      return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
    }
    function luminance([r, g, b]) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    function contrast(rgb1, rgb2) {
      const l1 = luminance(rgb1), l2 = luminance(rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function mix(rgb1, rgb2, w1) {
      return rgb1.map((c, i) => c * w1 + rgb2[i] * (1 - w1));
    }
    function applyAutoPalette(fgHex, bgHex) {
      const bgRgb = hexToRgb(bgHex);
      const rawFgRgb = hexToRgb(fgHex);
      const bgLum = luminance(bgRgb);
      const isDark = bgLum <= 0.18;
      const surfaceRgb = isDark ? mix(bgRgb, [255, 255, 255], 0.88) : [255, 255, 255];
      let safeFg = rawFgRgb;
      let adjusted = false;
      if (contrast(safeFg, bgRgb) < 4.5 || contrast(safeFg, surfaceRgb) < 4.5) {
        adjusted = true;
        const target = isDark ? [255, 255, 255] : [0, 0, 0];
        for (let step = 0.04; step <= 0.96; step += 0.04) {
          const candidate = mix(rawFgRgb, target, 1 - step);
          if (contrast(candidate, bgRgb) >= 4.5 && contrast(candidate, surfaceRgb) >= 4.5) {
            safeFg = candidate;
            break;
          }
        }
      }
      const primaryHex = rgbToHex(...safeFg);
      const onPrimary = contrast([255, 255, 255], safeFg) >= contrast([12, 18, 28], safeFg) ? "#ffffff" : "#0c121c";
      const root = document.documentElement;
      root.style.setProperty("--store-paper", bgHex);
      root.style.setProperty("--store-white", rgbToHex(...surfaceRgb));
      root.style.setProperty("--store-primary", primaryHex);
      root.style.setProperty("--store-primary-subtle", rgbToHex(...(isDark ? mix(bgRgb, safeFg, 0.78) : mix([255, 255, 255], safeFg, 0.88))));
      root.style.setProperty("--store-on-primary", onPrimary);
      root.style.setProperty("--store-ink", isDark ? "#f8fafc" : "#0f172a");
      root.style.setProperty("--store-muted", isDark ? "#cbd5e1" : "#475569");
      root.style.setProperty("--store-line", rgbToHex(...(isDark ? mix(bgRgb, [255, 255, 255], 0.78) : mix(bgRgb, [0, 0, 0], 0.84))));
      root.style.setProperty("--store-media-bg", rgbToHex(...(isDark ? mix(bgRgb, [255, 255, 255], 0.92) : mix(bgRgb, [255, 255, 255], 0.5))));
      const badge = document.getElementById("contrast-status");
      badge.textContent = adjusted
        ? "WCAG Auto-Adjusted (" + contrast(safeFg, bgRgb).toFixed(1) + ":1)"
        : "WCAG Optimal (" + contrast(safeFg, bgRgb).toFixed(1) + ":1)";
      badge.style.background = adjusted ? "#b45309" : "#064e3b";
      badge.style.color = adjusted ? "#fef3c7" : "#6ee7b7";
    }

    function setColors(fg, bg) {
      document.getElementById("fg-picker").value = fg;
      document.getElementById("bg-picker").value = bg;
      applyAutoPalette(fg, bg);
    }

    document.getElementById("fg-picker").addEventListener("input", (e) => applyAutoPalette(e.target.value, document.getElementById("bg-picker").value));
    document.getElementById("bg-picker").addEventListener("input", (e) => applyAutoPalette(document.getElementById("fg-picker").value, e.target.value));
    applyAutoPalette("${fgInit}", "${bgInit}");
  </script>
</body>
</html>`;
}

export async function generateAllTemplates() {
  const catalogEntries = [];

  for (const template of TEMPLATE_BLUEPRINTS) {
    const dir = join(__dirname, template.id);
    await mkdir(dir, { recursive: true });

    const cssPath = join(dir, "template.css");
    const previewPath = join(dir, "preview.html");

    await writeFile(cssPath, generateTemplateCss(template), "utf8");
    await writeFile(previewPath, generatePreviewHtml(template), "utf8");

    catalogEntries.push({
      id: template.id,
      name: template.name,
      mood: template.mood,
      description: template.description,
      previewImage: template.previewImage,
      stylesheet: `${template.id}/template.css`,
      preview: `${template.id}/preview.html`,
      defaults: template.defaults,
    });
  }

  const catalog = {
    version: 2,
    palettes: PALETTES,
    templates: catalogEntries,
  };

  await writeFile(join(__dirname, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n", "utf8");
  return catalog;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllTemplates()
    .then((catalog) => console.log(`Generated ${catalog.templates.length} templates and ${catalog.palettes.length} palettes in frontend/templates/`))
    .catch((err) => {
      console.error("Failed to generate templates:", err);
      process.exit(1);
    });
}
