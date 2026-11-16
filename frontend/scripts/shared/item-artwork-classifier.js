(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.Store254ItemArtwork = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  // Rich color palettes (gradient stage, highlight aura, primary fill, accent fill, ink stroke)
  const PALETTES = {
    cobalt: { bg1: "#eff6ff", bg2: "#dbeafe", orb: "#93c5fd", p1: "#2563eb", p2: "#60a5fa", accent: "#f59e0b", ink: "#1e3a8a" },
    emerald: { bg1: "#ecfdf5", bg2: "#d1fae5", orb: "#6ee7b7", p1: "#059669", p2: "#34d399", accent: "#f59e0b", ink: "#064e3b" },
    amber: { bg1: "#fffbeb", bg2: "#fef3c7", orb: "#fcd34d", p1: "#d97706", p2: "#fbbf24", accent: "#2563eb", ink: "#78350f" },
    rose: { bg1: "#fff1f2", bg2: "#ffe4e6", orb: "#fda4af", p1: "#e11d48", p2: "#fb7185", accent: "#f59e0b", ink: "#881337" },
    violet: { bg1: "#f5f3ff", bg2: "#ede9fe", orb: "#c4b5fd", p1: "#7c3aed", p2: "#a78bfa", accent: "#38bdf8", ink: "#4c1d95" },
    cyan: { bg1: "#ecfeff", bg2: "#cffafe", orb: "#67e8f9", p1: "#0891b2", p2: "#22d3ee", accent: "#f59e0b", ink: "#164e63" },
    terracotta: { bg1: "#fff7ed", bg2: "#ffedd5", orb: "#fdba74", p1: "#c2410c", p2: "#fb923c", accent: "#0d9488", ink: "#7c2d12" },
    forest: { bg1: "#f0fdf4", bg2: "#dcfce7", orb: "#86efac", p1: "#15803d", p2: "#4ade80", accent: "#eab308", ink: "#14532d" },
    indigo: { bg1: "#eef2ff", bg2: "#e0e7ff", orb: "#a5b4fc", p1: "#4f46e5", p2: "#818cf8", accent: "#f43f5e", ink: "#312e81" },
    plum: { bg1: "#fdf4ff", bg2: "#fae8ff", orb: "#f0abfc", p1: "#a21caf", p2: "#e879f9", accent: "#f59e0b", ink: "#701a75" },
    teal: { bg1: "#f0fdfa", bg2: "#ccfbf1", orb: "#5eead4", p1: "#0d9488", p2: "#2dd4bf", accent: "#fb7185", ink: "#134e4a" },
    slate: { bg1: "#f8fafc", bg2: "#e2e8f0", orb: "#cbd5e1", p1: "#334155", p2: "#64748b", accent: "#3b82f6", ink: "#0f172a" },
    gold: { bg1: "#fefce8", bg2: "#fef08a", orb: "#fde047", p1: "#ca8a04", p2: "#facc15", accent: "#7c3aed", ink: "#713f12" },
    crimson: { bg1: "#fef2f2", bg2: "#fee2e2", orb: "#fca5a5", p1: "#dc2626", p2: "#f87171", accent: "#fbbf24", ink: "#7f1d1d" },
    sky: { bg1: "#f0f9ff", bg2: "#e0f2fe", orb: "#7dd3fc", p1: "#0284c7", p2: "#38bdf8", accent: "#10b981", ink: "#0c4a6e" },
    mint: { bg1: "#ecfdf5", bg2: "#ccfbf1", orb: "#99f6e4", p1: "#0f766e", p2: "#14b8a6", accent: "#f97316", ink: "#115e59" },
  };

  // Multi-layer SVG vector scenes centered in viewBox 0 0 120 120
  // Token placeholders {{p1}}, {{p2}}, {{accent}}, {{ink}} get hydrated from the selected palette
  const ARTWORK_DEFINITIONS = [
    {
      id: "sneaker",
      label: "Sneakers & Athletic Footwear",
      palette: "cobalt",
      phrases: ["running shoe", "sports shoe", "trail runner", "air force", "air max", "basketball shoe"],
      keywords: ["sneaker", "sneakers", "trainer", "trainers", "kicks", "shoe", "shoes", "footwear", "viatu", "kiatu", "jordan", "adidas", "nike", "puma", "reebok", "vans", "converse", "new balance", "running", "jogging", "canvas", "boot", "boots", "timberland", "cleats"],
      svg: `
        <path d="M18 76c2-14 14-24 22-30l12 8c9 6 19 8 33 10 9 1 15 6 15 14v5H18v-7z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M18 81h82a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4v-7z" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M22 89h78" stroke="{{p2}}" stroke-width="2" stroke-dasharray="6 4"/>
        <path d="M48 53l8-5M55 58l8-5M62 62l7-4" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M25 74c10-2 18-8 24-14l14 12c-12 4-25 5-38 2z" fill="{{p2}}" opacity="0.9"/>
        <circle cx="88" cy="75" r="4" fill="{{accent}}"/>
      `,
    },
    {
      id: "dress_shoe",
      label: "Formal Leather & Clarks Shoes",
      palette: "terracotta",
      phrases: ["official shoe", "leather shoe", "dress shoe", "oxford shoe", "formal wear"],
      keywords: ["clarks", "clark", "santoni", "loafers", "loafer", "oxford", "oxfords", "brogue", "derby", "moccasin", "heels", "stiletto", "pumps", "sandals", "sandal", "slippers", "crocs", "official"],
      svg: `
        <path d="M17 72c3-11 11-22 18-24 6 6 14 7 20 1 10 10 24 17 44 18 5 0 8 4 8 9v6H17V72z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M17 81h90v7H73l-3-3H40v3H17v-7z" fill="{{ink}}"/>
        <path d="M26 71c16 0 28-4 36-11" stroke="{{p2}}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <path d="M51 54l4 5M56 57l4 5M61 60l4 5" stroke="{{accent}}" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="86" cy="73" rx="10" ry="3" fill="#ffffff" opacity="0.25"/>
      `,
    },
    {
      id: "shirt_apparel",
      label: "Clothing, Apparel & Shirts",
      palette: "indigo",
      phrases: ["t shirt", "polo shirt", "mens wear", "ladies wear", "street wear", "thrift clothes"],
      keywords: ["shirt", "tshirt", "tee", "hoodie", "jacket", "coat", "sweater", "trouser", "jeans", "denim", "shorts", "suit", "blazer", "nguo", "mtumba", "apparel", "fashion", "wear", "uniform", "jersey", "vest", "tracksuit"],
      svg: `
        <path d="M36 28l12-5c4 6 20 6 24 0l12 5 16 14-10 15-9-6v43H39V51l-9 6-10-15 16-14z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M48 23c4 8 20 8 24 0" fill="none" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M50 38h20v16H50z" fill="{{p2}}" opacity="0.35" stroke="{{ink}}" stroke-width="1.5" rx="3"/>
        <circle cx="60" cy="40" r="2" fill="#ffffff"/>
        <circle cx="60" cy="51" r="2" fill="#ffffff"/>
        <circle cx="60" cy="62" r="2" fill="#ffffff"/>
        <path d="M43 85h34" stroke="{{accent}}" stroke-width="3" stroke-linecap="round"/>
      `,
    },
    {
      id: "dress_fashion",
      label: "Dresses, Gowns & Tailoring",
      palette: "rose",
      phrases: ["evening gown", "wedding dress", "kitenge dress", "fashion design", "custom tailoring"],
      keywords: ["dress", "gown", "skirt", "blouse", "abaya", "kitenge", "ankara", "bridal", "lingerie", "silk", "tailor", "bespoke", "boutique", "saree", "jumpsuit", "kimono", "cape", "costume"],
      svg: `
        <path d="M47 22l5 12h16l5-12 9 4-5 20 17 44c-20 6-48 6-68 0l17-44-5-20 9-4z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M44 48h32" stroke="{{accent}}" stroke-width="4" stroke-linecap="round"/>
        <path d="M52 52l-10 38M60 52v40M68 52l10 38" stroke="{{p2}}" stroke-width="2" stroke-linecap="round" opacity="0.65"/>
        <circle cx="60" cy="48" r="3.5" fill="#ffffff" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "handbag",
      label: "Bags, Backpacks & Luggage",
      palette: "plum",
      phrases: ["travel bag", "laptop bag", "school bag", "leather bag", "crossbody bag"],
      keywords: ["bag", "handbag", "tote", "purse", "wallet", "clutch", "backpack", "rucksack", "suitcase", "luggage", "briefcase", "duffel", "pouch", "satchel", "mkoba"],
      svg: `
        <path d="M42 42V33c0-10 36-10 36 0v9" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <rect x="24" y="42" width="72" height="50" rx="12" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M24 56c18 9 54 9 72 0" fill="{{p2}}" opacity="0.55" stroke="{{ink}}" stroke-width="2"/>
        <rect x="53" y="55" width="14" height="12" rx="3" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="60" cy="61" r="2" fill="{{ink}}"/>
      `,
    },
    {
      id: "watch_luxury",
      label: "Watches, Jewelry & Luxury",
      palette: "gold",
      phrases: ["smart watch", "wrist watch", "gold ring", "wedding ring", "diamond jewelry"],
      keywords: ["watch", "watches", "rolex", "casio", "timepiece", "jewelry", "jewellery", "ring", "necklace", "earring", "bracelet", "bangle", "gold", "silver", "diamond", "emerald", "crown", "tiara", "pearl", "pendant", "gem"],
      svg: `
        <rect x="47" y="14" width="26" height="22" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="47" y="84" width="26" height="22" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="60" cy="60" r="27" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="60" cy="60" r="21" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <rect x="86" y="55" width="6" height="10" rx="2" fill="{{accent}}" stroke="{{ink}}" stroke-width="1.5"/>
        <path d="M60 44v16l10 7" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="60" cy="60" r="3" fill="{{accent}}"/>
      `,
    },
    {
      id: "sunglasses",
      label: "Eyewear, Glasses & Optics",
      palette: "cyan",
      phrases: ["sun glasses", "reading glasses", "blue light", "contact lens"],
      keywords: ["glasses", "sunglasses", "shades", "eyewear", "spectacles", "frames", "optician", "goggles", "visor", "monocle", "kaleidoscope"],
      svg: `
        <path d="M18 52c2-7 10-9 18-9h12c5 0 8 4 8 9l-2 14c-2 9-9 13-18 13s-15-5-17-14l-1-13z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M102 52c-2-7-10-9-18-9H72c-5 0-8 4-8 9l2 14c2 9 9 13 18 13s15-5 17-14l1-13z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M54 50c4-4 8-4 12 0" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/>
        <path d="M26 51l12 18M76 51l12 18" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
        <circle cx="90" cy="40" r="4" fill="{{accent}}"/>
      `,
    },
    {
      id: "smartphone",
      label: "Phones, Tablets & Accessories",
      palette: "sky",
      phrases: ["mobile phone", "screen protector", "phone case", "power bank", "fast charger", "phone repair"],
      keywords: ["phone", "smartphone", "iphone", "samsung", "tecno", "infinix", "xiaomi", "oppo", "pixel", "ipad", "tablet", "simu", "charger", "powerbank", "cable", "case", "screen", "mobile"],
      svg: `
        <rect x="35" y="14" width="50" height="92" rx="10" fill="{{ink}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="40" y="21" width="40" height="76" rx="6" fill="{{p2}}"/>
        <path d="M40 32l40-11v34L40 72z" fill="{{p1}}" opacity="0.7"/>
        <rect x="51" y="23" width="18" height="4" rx="2" fill="{{ink}}"/>
        <circle cx="52" cy="54" r="7" fill="#ffffff" opacity="0.9"/>
        <circle cx="68" cy="54" r="7" fill="{{accent}}" opacity="0.95"/>
        <rect x="47" y="70" width="26" height="12" rx="4" fill="#ffffff" opacity="0.88"/>
      `,
    },
    {
      id: "laptop_pc",
      label: "Laptops, Computers & IT",
      palette: "slate",
      phrases: ["laptop repair", "gaming pc", "macbook pro", "it support", "office computer"],
      keywords: ["laptop", "macbook", "computer", "pc", "desktop", "keyboard", "mouse", "ssd", "ram", "motherboard", "cpu", "gpu", "router", "wifi", "server", "printer", "it", "hardware", "workstation"],
      svg: `
        <rect x="24" y="24" width="72" height="48" rx="6" fill="{{ink}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="29" y="29" width="62" height="38" rx="3" fill="{{p1}}"/>
        <path d="M35 55l12-13 10 9 14-15 14 13v12H35z" fill="{{p2}}" opacity="0.85"/>
        <circle cx="44" cy="40" r="4" fill="{{accent}}"/>
        <path d="M14 74h92l-6 14H20l-6-14z" fill="#e2e8f0" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="48" y="78" width="24" height="4" rx="2" fill="{{ink}}" opacity="0.45"/>
      `,
    },
    {
      id: "tv_display",
      label: "TVs, Projectors & Displays",
      palette: "indigo",
      phrases: ["smart tv", "oled tv", "tv mount", "home theater", "led monitor"],
      keywords: ["tv", "television", "oled", "qled", "hisense", "tcl", "sony", "lg", "screen", "monitor", "projector", "display", "antenna", "decoder"],
      svg: `
        <rect x="16" y="24" width="88" height="54" rx="6" fill="{{ink}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="21" y="29" width="78" height="44" rx="3" fill="{{p1}}"/>
        <path d="M21 63c18-16 32-24 46-12s20-4 32-12v34H21z" fill="{{p2}}"/>
        <circle cx="38" cy="43" r="6" fill="{{accent}}"/>
        <path d="M60 78v10M40 90h40" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
      `,
    },
    {
      id: "headphones_audio",
      label: "Headphones, Woofers & Audio",
      palette: "violet",
      phrases: ["sound system", "bluetooth speaker", "ear buds", "sub woofer", "wireless headphones"],
      keywords: ["headphone", "headphones", "headset", "earbud", "earbuds", "airpod", "airpods", "speaker", "woofer", "subwoofer", "soundbar", "amplifier", "jbl", "sony", "bose", "audio", "bass", "boombox"],
      svg: `
        <path d="M28 60v-6c0-18 14-32 32-32s32 14 32 32v6" fill="none" stroke="{{ink}}" stroke-width="6" stroke-linecap="round"/>
        <rect x="18" y="54" width="16" height="32" rx="8" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="86" y="54" width="16" height="32" rx="8" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="24" y="59" width="6" height="22" rx="3" fill="{{accent}}"/>
        <rect x="90" y="59" width="6" height="22" rx="3" fill="{{accent}}"/>
        <path d="M46 72v-8m7 12V60m7 18V56m7 20V60m7 12v-8" stroke="{{p2}}" stroke-width="3" stroke-linecap="round"/>
      `,
    },
    {
      id: "music_studio",
      label: "Music Production, Beats & DJ",
      palette: "cobalt",
      phrases: ["music production", "beat making", "audio mixing", "mastering", "recording studio", "dj service"],
      keywords: ["beat", "beats", "music", "mziki", "producer", "mixing", "mastering", "studio", "dj", "turntable", "vinyl", "synthesizer", "midi", "track", "song", "instrumental", "soundtrack", "jingle"],
      svg: `
        <rect x="16" y="24" width="88" height="72" rx="10" fill="{{ink}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="48" cy="60" r="24" fill="{{p1}}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="48" cy="60" r="16" fill="none" stroke="{{p2}}" stroke-width="1.5" stroke-dasharray="6 4"/>
        <circle cx="48" cy="60" r="7" fill="{{accent}}" stroke="#ffffff" stroke-width="1.5"/>
        <rect x="80" y="34" width="14" height="8" rx="2" fill="{{p2}}"/>
        <rect x="82" y="48" width="10" height="38" rx="3" fill="#ffffff" opacity="0.2"/>
        <rect x="80" y="58" width="14" height="7" rx="2" fill="{{accent}}"/>
        <path d="M68 38l18 20" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      `,
    },
    {
      id: "microphone_podcast",
      label: "Microphones, Voice & Podcasting",
      palette: "crimson",
      phrases: ["voice over", "podcast recording", "live sound", "karaoke mic"],
      keywords: ["mic", "microphone", "podcast", "voiceover", "singing", "vocal", "radio", "broadcast", "pa", "mc", "megaphone", "intercom"],
      svg: `
        <rect x="46" y="18" width="28" height="44" rx="14" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M48 32h24M48 40h24M48 48h24" stroke="{{ink}}" stroke-width="2" opacity="0.5"/>
        <path d="M36 48v10c0 13 11 24 24 24s24-11 24-24V48" fill="none" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 82v16M44 98h32" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="28" r="4" fill="{{accent}}"/>
      `,
    },
    {
      id: "guitar_instrument",
      label: "Musical Instruments & Gear",
      palette: "terracotta",
      phrases: ["acoustic guitar", "electric guitar", "piano lessons", "drum set"],
      keywords: ["guitar", "piano", "keyboard", "drums", "violin", "saxophone", "trumpet", "ukulele", "flute", "harp", "accordion", "kazoo", "instrument", "music lesson"],
      svg: `
        <path d="M84 20l14 14-12 12-6-6-22 22c7 9 6 22-3 31-10 10-27 10-37 0s-10-27 0-37c9-9 22-10 31-3l22-22-6-6 19-5z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="38" cy="79" r="9" fill="{{ink}}"/>
        <circle cx="38" cy="79" r="5" fill="{{accent}}"/>
        <path d="M24 93l58-58" stroke="#ffffff" stroke-width="1.5" opacity="0.75"/>
      `,
    },
    {
      id: "camera_photo",
      label: "Cameras, Photography & Video",
      palette: "slate",
      phrases: ["photo shoot", "wedding photography", "video coverage", "mirrorless camera", "ring light"],
      keywords: ["camera", "canon", "nikon", "fujifilm", "gopro", "lens", "tripod", "photography", "photographer", "videography", "videographer", "portrait", "shoot", "webcam", "gimbal", "picha"],
      svg: `
        <path d="M20 40h18l6-10h32l6 10h18a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="60" cy="64" r="19" fill="{{ink}}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="60" cy="64" r="12" fill="{{p2}}"/>
        <circle cx="55" cy="59" r="4" fill="#ffffff" opacity="0.8"/>
        <circle cx="89" cy="50" r="3.5" fill="{{accent}}"/>
      `,
    },
    {
      id: "gaming_console",
      label: "Gaming, Consoles & VR",
      palette: "indigo",
      phrases: ["playstation 5", "game console", "vr headset", "gaming chair", "retro arcade"],
      keywords: ["game", "gaming", "ps5", "ps4", "playstation", "xbox", "nintendo", "switch", "controller", "joystick", "vr", "arcade", "esports", "chess", "dice", "boardgame", "michezo"],
      svg: `
        <path d="M32 42h56c12 0 20 14 20 32 0 12-7 18-14 14l-14-12H40L26 88c-7 4-14-2-14-14 0-18 8-32 20-32z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M34 55v16M26 63h16" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <circle cx="80" cy="56" r="4" fill="{{accent}}"/>
        <circle cx="90" cy="64" r="4" fill="#34d399"/>
        <circle cx="80" cy="72" r="4" fill="#fb7185"/>
        <circle cx="70" cy="64" r="4" fill="{{p2}}"/>
      `,
    },
    {
      id: "drone_flight",
      label: "Drones, Aviation & RC",
      palette: "cyan",
      phrases: ["drone footage", "aerial photography", "rc plane", "hot air balloon"],
      keywords: ["drone", "quadcopter", "dji", "aerial", "helicopter", "plane", "flight", "paragliding", "parachute", "balloon", "kite", "aviation"],
      svg: `
        <path d="M32 36l56 48M88 36L32 84" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <rect x="47" y="47" width="26" height="26" rx="8" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <ellipse cx="30" cy="34" rx="14" ry="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <ellipse cx="90" cy="34" rx="14" ry="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <ellipse cx="30" cy="86" rx="14" ry="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <ellipse cx="90" cy="86" rx="14" ry="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="60" cy="60" r="6" fill="{{accent}}" stroke="#ffffff" stroke-width="1.5"/>
      `,
    },
    {
      id: "rocket_space",
      label: "Space, Sci-Fi & Novelty",
      palette: "violet",
      phrases: ["space suit", "sci fi", "alien prop", "star projector"],
      keywords: ["rocket", "space", "astronaut", "ufo", "alien", "galaxy", "planet", "moon", "meteor", "star", "lightsaber", "laser", "quantum", "cyber", "futuristic", "sci-fi"],
      svg: `
        <path d="M60 14c16 14 22 36 18 58l-18 8-18-8c-4-22 2-44 18-58z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M42 58l-14 14 12 6M78 58l14 14-12 6" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="60" cy="43" r="9" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="60" cy="43" r="5" fill="{{accent}}"/>
        <path d="M53 80l7 22 7-22z" fill="#f97316" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "telescope_astro",
      label: "Telescopes & Stargazing",
      palette: "indigo",
      phrases: ["optical telescope", "telescope lens", "star gazing", "night sky", "optical scope"],
      keywords: ["telescope", "astronomy", "binoculars", "stargazing", "observatory", "optics", "compass", "monocular"],
      svg: `
        <path d="M22 46l62-22 8 20-62 18z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <ellipse cx="88" cy="34" rx="5" ry="11" transform="rotate(-20 88 34)" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M55 58l-18 44M55 58l18 44M55 58v44" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="55" cy="58" r="6" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="28" cy="24" r="3" fill="{{accent}}"/>
        <circle cx="96" cy="64" r="2.5" fill="{{accent}}"/>
      `,
    },
    {
      id: "coffee_cafe",
      label: "Coffee, Tea & Cafes",
      palette: "terracotta",
      phrases: ["coffee shop", "coffee beans", "iced coffee", "tea pot", "tumbler mug"],
      keywords: ["coffee", "espresso", "latte", "cappuccino", "tea", "chai", "matcha", "cafe", "mug", "cup", "thermos", "flask", "tumbler", "kahawa", "kettle"],
      svg: `
        <path d="M28 46h52v32c0 12-10 20-26 20s-26-8-26-20V46z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M80 52h10c7 0 11 5 11 11s-4 11-11 11H80" fill="none" stroke="{{ink}}" stroke-width="3.5"/>
        <path d="M24 98h62" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M43 34c-4-6 4-10 0-16M55 34c-4-6 4-10 0-16M67 34c-4-6 4-10 0-16" fill="none" stroke="{{p2}}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="54" cy="69" r="9" fill="#ffffff" opacity="0.88"/>
      `,
    },
    {
      id: "restaurant_food",
      label: "Meals, Dining & Catering",
      palette: "crimson",
      phrases: ["fast food", "nyama choma", "outside catering", "food delivery", "home cooked"],
      keywords: ["food", "meal", "lunch", "dinner", "breakfast", "restaurant", "catering", "burger", "pizza", "chicken", "beef", "nyama", "choma", "biryani", "pilau", "shawarma", "chips", "samosa", "chakula", "snack", "chef", "spice"],
      svg: `
        <ellipse cx="60" cy="76" rx="42" ry="12" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M22 72c2-22 18-36 38-36s36 14 38 36H22z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="60" cy="30" r="6" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M36 62c6-9 14-14 24-15" fill="none" stroke="{{p2}}" stroke-width="3" stroke-linecap="round"/>
      `,
    },
    {
      id: "bakery_cake",
      label: "Bakery, Cakes & Confectionery",
      palette: "rose",
      phrases: ["birthday cake", "wedding cake", "fresh bread", "pastry box"],
      keywords: ["cake", "keki", "cupcake", "bakery", "bread", "pastry", "croissant", "cookie", "biscuit", "donut", "doughnut", "muffin", "chocolate", "candy", "sweet", "dessert", "ice cream"],
      svg: `
        <rect x="24" y="64" width="72" height="30" rx="8" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="36" y="42" width="48" height="24" rx="6" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M24 72c6 6 12 6 18 0s12 6 18 0 12 6 18 0 12 6 18 0" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <rect x="57" y="25" width="6" height="17" rx="2" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <path d="M60 14c4 5 5 9 0 12-5-3-4-7 0-12z" fill="{{accent}}" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "fresh_produce",
      label: "Groceries, Fruits & Produce",
      palette: "forest",
      phrases: ["fresh fruit", "organic vegetable", "mama mboga", "farm fresh"],
      keywords: ["fruit", "vegetable", "grocery", "groceries", "produce", "mango", "avocado", "banana", "apple", "orange", "pineapple", "tomato", "onion", "potato", "maize", "beans", "rice", "flour", "unga", "sugar", "cooking oil"],
      svg: `
        <path d="M24 58h72l-8 34H32l-8-34z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M36 58c0-18 48-18 48 0" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="46" cy="50" r="11" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="72" cy="48" r="12" fill="#ef4444" stroke="{{ink}}" stroke-width="2"/>
        <path d="M60 32c6-10 14-12 20-8-4 8-12 12-20 8z" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "beverage_drinks",
      label: "Beverages, Juices & Bottles",
      palette: "teal",
      phrases: ["water dispenser", "fresh juice", "wine bottle", "craft drink"],
      keywords: ["drink", "juice", "smoothie", "soda", "water", "wine", "beer", "whisky", "gin", "bottle", "cocktail", "milk", "yoghurt", "kombucha", "liquor"],
      svg: `
        <path d="M49 16h22v14l11 16v48a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V46l11-16V16z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="46" y="12" width="28" height="7" rx="3" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <rect x="42" y="54" width="36" height="26" rx="4" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="60" cy="67" r="7" fill="{{p2}}"/>
      `,
    },
    {
      id: "kitchen_cookware",
      label: "Kitchen, Cookware & Appliances",
      palette: "cyan",
      phrases: ["air fryer", "kitchen blender", "gas cooker", "microwave oven", "pressure cooker"],
      keywords: ["kitchen", "blender", "mixer", "toaster", "microwave", "oven", "fridge", "freezer", "cooker", "stove", "sufuria", "pot", "pan", "kettle", "cutlery", "knife", "plate", "flask", "dispenser", "appliance"],
      svg: `
        <path d="M38 30h44l-5 44H43l-5-44z" fill="{{p2}}" opacity="0.65" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="36" y="22" width="48" height="8" rx="4" fill="{{ink}}"/>
        <path d="M35 74h50l6 24H29l6-24z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="60" cy="86" r="6" fill="{{accent}}" stroke="#ffffff" stroke-width="2"/>
        <path d="M47 42h26M48 54h24" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
      `,
    },
    {
      id: "sofa_furniture",
      label: "Furniture & Home Living",
      palette: "terracotta",
      phrases: ["living room", "sofa set", "office chair", "dining table", "king bed"],
      keywords: ["sofa", "couch", "chair", "table", "desk", "bed", "mattress", "wardrobe", "cabinet", "shelf", "furniture", "bench", "stool", "recliner", "beanbag", "decor", "interior"],
      svg: `
        <path d="M24 44a10 10 0 0 1 10-10h52a10 10 0 0 1 10 10v22H24V44z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="14" y="54" width="16" height="30" rx="6" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="90" y="54" width="16" height="30" rx="6" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="24" y="64" width="72" height="20" rx="4" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M26 84v12M94 84v12" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <rect x="44" y="42" width="32" height="16" rx="4" fill="{{accent}}" opacity="0.88" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "lamp_lighting",
      label: "Lighting, Lamps & Neon",
      palette: "gold",
      phrases: ["table lamp", "chandelier light", "neon sign", "lava lamp", "led strip"],
      keywords: ["lamp", "light", "lighting", "bulb", "led", "chandelier", "lantern", "torch", "spotlight", "floodlight", "neon", "lava lamp"],
      svg: `
        <path d="M36 22h48l14 34H22L36 22z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M46 22h28l6 34H40z" fill="{{p2}}" opacity="0.55"/>
        <path d="M60 56v36M40 94h40" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="64" r="7" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M72 64v12" stroke="{{accent}}" stroke-width="2.5" stroke-linecap="round"/>
      `,
    },
    {
      id: "carpet_textile",
      label: "Bedding, Curtains & Carpets",
      palette: "plum",
      phrases: ["bed sheets", "duvet cover", "floor carpet", "window curtain"],
      keywords: ["carpet", "rug", "duvet", "bedsheet", "pillow", "blanket", "curtain", "curtains", "towel", "mat", "doormat", "linen", "fabric", "cloth", "textile", "cushion"],
      svg: `
        <rect x="22" y="28" width="76" height="64" rx="10" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="32" y="38" width="56" height="44" rx="5" fill="{{p2}}" stroke="#ffffff" stroke-width="2"/>
        <path d="M42 50l18-10 18 10-18 22z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M22 96h76" stroke="{{ink}}" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/>
      `,
    },
    {
      id: "skincare_beauty",
      label: "Skincare, Serums & Fragrance",
      palette: "mint",
      phrases: ["skin care", "vitamin c serum", "body lotion", "face cream", "perfume bottle"],
      keywords: ["skincare", "serum", "cream", "lotion", "moisturizer", "cleanser", "toner", "sunscreen", "soap", "perfume", "cologne", "fragrance", "deodorant", "uremb", "cosmetics", "oil", "shea", "aloe"],
      svg: `
        <rect x="48" y="16" width="24" height="14" rx="4" fill="{{ink}}"/>
        <path d="M42 30h36l6 12v48a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10V42l6-12z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="44" y="48" width="32" height="34" rx="5" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <path d="M60 56c5 6 7 10 7 14a7 7 0 1 1-14 0c0-4 2-8 7-14z" fill="{{p2}}"/>
      `,
    },
    {
      id: "makeup_glam",
      label: "Makeup, Nails & Glam",
      palette: "rose",
      phrases: ["lip gloss", "nail polish", "makeup kit", "gel polish"],
      keywords: ["makeup", "lipstick", "mascara", "foundation", "powder", "eyeshadow", "nail", "manicure", "pedicure", "lash", "lashes", "blush", "glam"],
      svg: `
        <rect x="38" y="54" width="44" height="44" rx="7" fill="{{ink}}"/>
        <rect x="43" y="40" width="34" height="16" rx="3" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M47 40V22c4-6 22-8 26 2v16H47z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M54 22l12 6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      `,
    },
    {
      id: "hair_salon",
      label: "Barber, Hair & Salon",
      palette: "plum",
      phrases: ["hair cut", "human hair", "braid styling", "beard trim", "hair salon"],
      keywords: ["hair", "wig", "wigs", "braid", "braiding", "dreadlocks", "salon", "barber", "kinyozi", "nywele", "clipper", "shaver", "comb", "scissors", "dryer", "curler", "shampoo"],
      svg: `
        <circle cx="34" cy="82" r="12" fill="none" stroke="{{ink}}" stroke-width="4.5"/>
        <circle cx="86" cy="82" r="12" fill="none" stroke="{{ink}}" stroke-width="4.5"/>
        <path d="M41 72l44-50M79 72L35 22" stroke="{{p1}}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="60" cy="50" r="5" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "spa_wellness",
      label: "Spa, Massage & Aromatherapy",
      palette: "teal",
      phrases: ["deep tissue", "massage therapy", "scented candle", "essential oil"],
      keywords: ["spa", "massage", "sauna", "facial", "wellness", "therapy", "candle", "incense", "aromatherapy", "meditation", "relaxation", "reflexology"],
      svg: `
        <ellipse cx="60" cy="86" rx="32" ry="9" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <ellipse cx="60" cy="70" rx="25" ry="9" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <ellipse cx="60" cy="55" rx="18" ry="8" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M60 22c7 9 8 15 0 21-8-6-7-12 0-21z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M36 44c-6-6-4-14 4-16M84 44c6-6 4-14-4-16" fill="none" stroke="{{p2}}" stroke-width="2.5" stroke-linecap="round"/>
      `,
    },
    {
      id: "pharmacy_med",
      label: "Pharmacy, Clinic & Health",
      palette: "emerald",
      phrases: ["first aid", "blood pressure", "medical checkup", "vitamin supplement"],
      keywords: ["medicine", "pharmacy", "chemist", "dawa", "pill", "pills", "vitamin", "supplement", "protein", "clinic", "doctor", "nurse", "health", "stethoscope", "thermometer", "bandage", "first-aid", "dental", "dentist", "physio"],
      svg: `
        <rect x="20" y="34" width="80" height="62" rx="12" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M46 34v-8a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v8" fill="none" stroke="{{ink}}" stroke-width="3.5"/>
        <path d="M54 48h12v11h11v12H66v11H54V71H43V59h11V48z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="88" cy="46" r="4" fill="{{accent}}"/>
      `,
    },
    {
      id: "fitness_gym",
      label: "Fitness, Sports & Gym",
      palette: "cobalt",
      phrases: ["gym membership", "personal trainer", "yoga mat", "football boot"],
      keywords: ["gym", "fitness", "dumbbell", "barbell", "weight", "weights", "kettlebell", "yoga", "treadmill", "sports", "football", "soccer", "basketball", "tennis", "boxing", "gloves", "trainer", "workout", "trampoline"],
      svg: `
        <rect x="30" y="54" width="60" height="12" rx="4" fill="{{ink}}"/>
        <rect x="14" y="36" width="12" height="48" rx="4" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="26" y="42" width="10" height="36" rx="3" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="84" y="42" width="10" height="36" rx="3" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="94" y="36" width="12" height="48" rx="4" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="60" cy="30" r="6" fill="{{accent}}"/>
      `,
    },
    {
      id: "bicycle_ride",
      label: "Bicycles, Scooters & Skate",
      palette: "emerald",
      phrases: ["mountain bike", "electric scooter", "skate board"],
      keywords: ["bicycle", "bike", "ebike", "scooter", "skateboard", "rollerblade", "unicycle", "cycling", "baiskeli"],
      svg: `
        <circle cx="32" cy="76" r="18" fill="none" stroke="{{ink}}" stroke-width="4.5"/>
        <circle cx="88" cy="76" r="18" fill="none" stroke="{{ink}}" stroke-width="4.5"/>
        <path d="M32 76l20-32h26l10 32M52 44l8 32h28M44 36h16M74 36h12" fill="none" stroke="{{p1}}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="60" cy="76" r="5" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "car_auto",
      label: "Automotive, Spares & Car Care",
      palette: "slate",
      phrases: ["car wash", "auto spares", "oil change", "wheel alignment", "car detailing"],
      keywords: ["car", "gari", "auto", "vehicle", "tyre", "tire", "wheel", "rim", "engine", "battery", "brake", "oil", "radiator", "headlight", "mechanic", "garage", "carwash", "detailing", "suv", "truck"],
      svg: `
        <path d="M22 60l10-20h56l10 20v20H22V60z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M35 44h50l6 14H29l6-14z" fill="{{p2}}"/>
        <circle cx="36" cy="80" r="11" fill="{{ink}}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="84" cy="80" r="11" fill="{{ink}}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="36" cy="80" r="4" fill="#ffffff"/>
        <circle cx="84" cy="80" r="4" fill="#ffffff"/>
        <rect x="26" y="64" width="12" height="6" rx="2" fill="{{accent}}"/>
        <rect x="82" y="64" width="12" height="6" rx="2" fill="{{accent}}"/>
      `,
    },
    {
      id: "motorcycle_boda",
      label: "Motorcycles, Boda & Helmets",
      palette: "crimson",
      phrases: ["motor bike", "boda boda", "crash helmet"],
      keywords: ["motorcycle", "motorbike", "boda", "scooter", "helmet", "boxer", "tvs", "bajaj", "yamaha", "riding"],
      svg: `
        <path d="M30 62c0-22 15-36 34-36 18 0 32 14 32 34v12c0 10-8 16-20 16H44l-14-26z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M62 38h28c4 8 4 18 0 24H60c-6-6-6-18 2-24z" fill="{{ink}}"/>
        <path d="M65 44l18 4" stroke="{{p2}}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="46" cy="68" r="6" fill="{{accent}}" stroke="#ffffff" stroke-width="1.5"/>
      `,
    },
    {
      id: "plumbing_water",
      label: "Plumbing, Pipes & Water Systems",
      palette: "sky",
      phrases: ["pipe fitting", "water pump", "borehole", "sink tap", "drain cleaning"],
      keywords: ["plumb", "plumber", "plumbing", "pipe", "faucet", "tap", "water", "maji", "tank", "pump", "drain", "sink", "toilet", "shower", "geyser", "valve", "filter"],
      svg: `
        <path d="M22 46h24v-14h16v14h32v18H62v10H46V64H22V46z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M40 22h28" stroke="{{ink}}" stroke-width="5" stroke-linecap="round"/>
        <path d="M54 22v10" stroke="{{ink}}" stroke-width="5"/>
        <path d="M84 74c6 7 8 11 8 15a8 8 0 1 1-16 0c0-4 2-8 8-15z" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "electrical_power",
      label: "Electrical, Wiring & Generators",
      palette: "amber",
      phrases: ["circuit breaker", "house wiring", "backup power", "voltage stabilizer"],
      keywords: ["electric", "electrical", "electrician", "umeme", "wire", "wiring", "cable", "socket", "switch", "breaker", "ups", "generator", "voltage", "extension", "plug"],
      svg: `
        <circle cx="60" cy="60" r="36" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M64 28L40 64h18l-6 28 28-38H62l2-26z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
      `,
    },
    {
      id: "solar_energy",
      label: "Solar Panels & Clean Energy",
      palette: "cobalt",
      phrases: ["solar panel", "solar inverter", "solar system", "solar water heater", "solar battery"],
      keywords: ["solar", "photovoltaic", "inverter", "panel", "renewable", "wind turbine", "green energy", "sunpower"],
      svg: `
        <circle cx="88" cy="28" r="12" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M22 46l56-10 18 44-56 10-18-44z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M36 44l18 43M52 41l18 43M68 38l18 43M29 62l56-10M35 76l56-10" stroke="{{p2}}" stroke-width="2"/>
        <path d="M58 88v16M40 104h36" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
      `,
    },
    {
      id: "construction_tools",
      label: "Hardware, Tools & Building",
      palette: "terracotta",
      phrases: ["building material", "power tool", "iron sheet", "carpentry service"],
      keywords: ["hardware", "tool", "tools", "hammer", "drill", "saw", "cement", "mabati", "timber", "wood", "mbao", "nail", "screw", "bolt", "tile", "brick", "carpenter", "fundi", "masonry", "roofing", "wrench", "spanner"],
      svg: `
        <path d="M32 30h38l12 10-12 10H54v48H42V50H32V30z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="40" y="56" width="16" height="42" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M70 58l24 24-8 8-24-24z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
      `,
    },
    {
      id: "painting_art",
      label: "Paint, Art & Mural Finishes",
      palette: "plum",
      phrases: ["wall paint", "interior painting", "canvas art", "art supplies"],
      keywords: ["paint", "painter", "rangi", "brush", "roller", "primer", "varnish", "art", "canvas", "easel", "acrylic", "drawing", "sketch", "sculpture", "mural", "portrait", "calligraphy", "gypsum"],
      svg: `
        <path d="M26 30h58v22H26V30z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" rx="6"/>
        <path d="M84 41h10v18L60 66v12" fill="none" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="52" y="76" width="16" height="28" rx="5" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M36 30v12M50 30v16M68 30v10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      `,
    },
    {
      id: "welding_flame",
      label: "Welding, Metalwork & Forging",
      palette: "crimson",
      phrases: ["steel gate", "metal fabrication", "window grille", "custom sword"],
      keywords: ["weld", "welder", "welding", "steel", "iron", "metal", "grille", "gate", "blacksmith", "forge", "anvil", "knife", "blade", "katana", "sword", "flame", "torch"],
      svg: `
        <path d="M60 16c12 16 26 26 26 48a26 26 0 1 1-52 0c0-13 6-24 14-32 2 8 6 12 10 12 4-9 2-18 2-28z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 48c7 8 13 14 13 24a13 13 0 1 1-26 0c0-9 6-16 13-24z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M24 98h72" stroke="{{ink}}" stroke-width="5" stroke-linecap="round"/>
      `,
    },
    {
      id: "cleaning_service",
      label: "Cleaning, Laundry & Fumigation",
      palette: "cyan",
      phrases: ["dry clean", "sofa cleaning", "carpet cleaning", "pest control", "house cleaning"],
      keywords: ["clean", "cleaning", "usafi", "laundry", "fumigation", "pest", "detergent", "soap", "bleach", "vacuum", "mop", "broom", "sanitizer", "wash", "housekeeping", "maid"],
      svg: `
        <path d="M44 36h26l8 16v42a8 8 0 0 1-8 8H44a8 8 0 0 1-8-8V52l8-16z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M44 36V22h32l8 8H62v6" fill="{{ink}}" stroke="{{ink}}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="44" y="58" width="26" height="24" rx="4" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <path d="M90 28l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="{{accent}}"/>
        <circle cx="96" cy="52" r="4" fill="{{p2}}"/>
      `,
    },
    {
      id: "security_cctv",
      label: "Security, CCTV & Smart Locks",
      palette: "slate",
      phrases: ["cctv camera", "electric fence", "smart lock", "access control"],
      keywords: ["cctv", "security", "alarm", "lock", "padlock", "key", "safe", "fence", "guard", "biometric", "surveillance", "bell", "shield"],
      svg: `
        <path d="M22 44l56-16 14 28-56 16-14-28z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <ellipse cx="86" cy="42" rx="6" ry="12" transform="rotate(-24 86 42)" fill="{{ink}}"/>
        <circle cx="85" cy="42" r="4" fill="{{accent}}"/>
        <path d="M42 66v24H22" fill="none" stroke="{{ink}}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="94" cy="24" r="4" fill="#ef4444"/>
      `,
    },
    {
      id: "real_estate",
      label: "Property, Rentals & Moving",
      palette: "emerald",
      phrases: ["real estate", "bedsitter", "home moving", "house hunting", "air bnb"],
      keywords: ["house", "home", "nyumba", "apartment", "flat", "villa", "land", "plot", "rent", "lease", "airbnb", "estate", "moving", "relocation", "property"],
      svg: `
        <path d="M16 56L60 20l44 36v42H16V56z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M12 58L60 18l48 40" fill="none" stroke="{{ink}}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="48" y="64" width="24" height="34" rx="3" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="26" y="62" width="14" height="14" rx="2" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <rect x="80" y="62" width="14" height="14" rx="2" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "camping_outdoor",
      label: "Camping, Safari & Travel",
      palette: "forest",
      phrases: ["camping tent", "sleeping bag", "safari tour", "hiking gear"],
      keywords: ["tent", "camping", "safari", "hiking", "mountain", "backpack", "kayak", "boat", "canoe", "surfboard", "tour", "travel", "expedition", "adventure", "lantern"],
      svg: `
        <path d="M60 22l42 72H18L60 22z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 50l16 44H44l16-44z" fill="{{ink}}"/>
        <path d="M50 14l20 16M70 14L50 30" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="90" cy="30" r="9" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "garden_plants",
      label: "Plants, Bonsai & Landscaping",
      palette: "mint",
      phrases: ["potted plant", "indoor plant", "lawn care", "bonsai tree"],
      keywords: ["plant", "flower", "bonsai", "cactus", "succulent", "monstera", "terrarium", "seed", "seeds", "pot", "planter", "soil", "manure", "garden", "lawn", "tree", "nursery", "landscaping", "grass", "herb"],
      svg: `
        <path d="M34 68h52l-7 30H41l-7-30z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="29" y="60" width="62" height="10" rx="4" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M60 60V34" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 44c-18 0-26-10-24-22 14 0 24 8 24 22z" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M60 36c16-4 24-14 22-24-14 2-22 10-22 24z" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "farm_livestock",
      label: "Agrovets, Livestock & Farming",
      palette: "forest",
      phrases: ["animal feed", "dairy meal", "egg incubator", "poultry farming"],
      keywords: ["farm", "agrovet", "kilimo", "chicken", "kuku", "eggs", "goat", "mbuzi", "cow", "ngombe", "sheep", "pig", "feed", "fertilizer", "tractor", "greenhouse", "drip", "incubator", "hatchery", "livestock"],
      svg: `
        <path d="M20 96V54l40-30 40 30v42H20z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="42" y="60" width="36" height="36" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M42 60l36 36M78 60L42 96" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="52" y="38" width="16" height="14" rx="2" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "beekeeping_honey",
      label: "Honey, Apiary & Beekeeping",
      palette: "gold",
      phrases: ["raw honey", "bee hive", "bees wax"],
      keywords: ["honey", "asali", "bee", "beekeeping", "hive", "apiary", "honeycomb", "beeswax", "pollen", "propolis"],
      svg: `
        <path d="M36 40h48l6 14v32a12 12 0 0 1-12 12H42a12 12 0 0 1-12-12V54l6-14z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="38" y="24" width="44" height="12" rx="5" fill="{{ink}}"/>
        <path d="M60 54l12 7v14l-12 7-12-7V61l12-7z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="92" cy="28" r="5" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "aquarium_fish",
      label: "Fish, Seafood & Aquariums",
      palette: "sky",
      phrases: ["fish tank", "fresh tilapia", "aquarium filter", "scuba gear"],
      keywords: ["fish", "samaki", "tilapia", "salmon", "tuna", "prawns", "seafood", "aquarium", "coral", "octopus", "jellyfish", "scuba", "diving", "submarine", "shell"],
      svg: `
        <path d="M28 60c14-20 42-22 60-6l16-12v36L88 66c-18 16-46 14-60-6z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="44" cy="56" r="4" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <path d="M58 46c-4 10-4 18 0 28" fill="none" stroke="{{accent}}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="20" cy="40" r="4" fill="{{p2}}"/>
        <circle cx="15" cy="28" r="2.5" fill="{{p2}}"/>
      `,
    },
    {
      id: "pets_veterinary",
      label: "Pets, Veterinary & Animal Care",
      palette: "terracotta",
      phrases: ["dog food", "cat litter", "vet clinic", "pet grooming", "exotic pet"],
      keywords: ["pet", "dog", "puppy", "cat", "kitten", "vet", "veterinary", "collar", "leash", "kibble", "reptile", "snake", "lizard", "iguana", "parrot", "rabbit", "hamster", "taxidermy"],
      svg: `
        <ellipse cx="60" cy="74" rx="22" ry="18" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="32" cy="46" r="9" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="50" cy="34" r="9" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="70" cy="34" r="9" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="88" cy="46" r="9" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="60" cy="75" r="7" fill="{{accent}}" opacity="0.9"/>
      `,
    },
    {
      id: "baby_kids",
      label: "Baby Care, Strollers & Toys",
      palette: "mint",
      phrases: ["baby stroller", "baby carrier", "sleep consultation", "soft toy"],
      keywords: ["baby", "newborn", "toddler", "kids", "stroller", "crib", "diaper", "diapers", "pampers", "pacifier", "toy", "toys", "teddy", "plush", "plushie", "lego", "doll", "rubber duck", "nursery"],
      svg: `
        <circle cx="60" cy="54" r="22" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="38" cy="34" r="10" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="82" cy="34" r="10" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <ellipse cx="60" cy="60" rx="12" ry="9" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="52" cy="48" r="2.5" fill="{{ink}}"/>
        <circle cx="68" cy="48" r="2.5" fill="{{ink}}"/>
        <circle cx="60" cy="58" r="3" fill="{{ink}}"/>
        <path d="M40 80c12 10 28 10 40 0l6 14H34l6-14z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
      `,
    },
    {
      id: "books_education",
      label: "Books, Stationery & Courses",
      palette: "cobalt",
      phrases: ["online course", "tuition class", "text book", "revision book"],
      keywords: ["book", "books", "vitabu", "novel", "bible", "journal", "diary", "notebook", "textbook", "library", "course", "class", "tuition", "tutor", "coaching", "lesson", "training", "workshop", "graduation", "ebook"],
      svg: `
        <path d="M18 32c14-6 30-4 42 6 12-10 28-12 42-6v56c-14-6-30-4-42 6-12-10-28-12-42-6V32z" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 38v56" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M28 45h22M28 55h22M28 65h18" stroke="{{p1}}" stroke-width="3" stroke-linecap="round"/>
        <path d="M70 45h22M70 55h22M70 65h18" stroke="{{p2}}" stroke-width="3" stroke-linecap="round"/>
        <path d="M84 20v24l-5-4-5 4V20z" fill="{{accent}}" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "office_stationery",
      label: "Printing, Branding & Office",
      palette: "indigo",
      phrases: ["business cards", "t-shirt printing", "banner design", "office supplies"],
      keywords: ["print", "printing", "printer", "flyer", "banner", "sticker", "brand", "branding", "stamp", "pen", "stationery", "envelope", "folder", "photocopy", "laminate", "paper", "card"],
      svg: `
        <rect x="30" y="18" width="60" height="24" rx="4" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="16" y="38" width="88" height="36" rx="8" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="30" y="62" width="60" height="38" rx="4" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M40 74h40M40 84h26" stroke="{{p2}}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="88" cy="49" r="4" fill="{{accent}}"/>
      `,
    },
    {
      id: "digital_software",
      label: "Software, Websites & Digital",
      palette: "violet",
      phrases: ["web design", "mobile app", "graphic design", "seo service", "digital download"],
      keywords: ["website", "software", "app", "saas", "code", "coding", "developer", "design", "logo", "template", "plugin", "domain", "hosting", "crypto", "nft", "digital", "automation", "ai"],
      svg: `
        <rect x="16" y="22" width="88" height="72" rx="10" fill="{{ink}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="21" y="36" width="78" height="53" rx="6" fill="{{p1}}"/>
        <circle cx="27" cy="29" r="2.5" fill="#fb7185"/>
        <circle cx="35" cy="29" r="2.5" fill="{{accent}}"/>
        <circle cx="43" cy="29" r="2.5" fill="#34d399"/>
        <path d="M46 53l-11 9 11 9M74 53l11 9-11 9M63 50l-6 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      `,
    },
    {
      id: "robot_3dprint",
      label: "Robotics, 3D Printing & Makers",
      palette: "cyan",
      phrases: ["3d print", "3d printing", "arduino kit", "laser cut"],
      keywords: ["robot", "robotics", "3d", "printer", "arduino", "raspberry", "sensor", "microcontroller", "cnc", "laser", "diorama", "prototype", "gadget", "hologram", "holographic"],
      svg: `
        <path d="M60 14v12" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="60" cy="14" r="4.5" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <rect x="26" y="26" width="68" height="54" rx="14" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="16" y="44" width="10" height="18" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <rect x="94" y="44" width="10" height="18" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="45" cy="49" r="7" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="75" cy="49" r="7" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="45" cy="49" r="3" fill="{{accent}}"/>
        <circle cx="75" cy="49" r="3" fill="{{accent}}"/>
        <rect x="42" y="65" width="36" height="8" rx="4" fill="{{ink}}"/>
        <path d="M42 80l-6 18h48l-6-18" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
      `,
    },
    {
      id: "lab_science",
      label: "Science, Chemistry, Fossils & Minerals",
      palette: "teal",
      phrases: ["science kit", "chemistry set", "lab test", "mineral sample"],
      keywords: ["science", "lab", "chemistry", "microscope", "flask", "beaker", "dna", "fossil", "dinosaur", "crystal", "quartz", "mineral", "meteorite", "bone", "specimen", "research"],
      svg: `
        <path d="M46 20h28v8h-5v18l21 38a8 8 0 0 1-7 12H37a8 8 0 0 1-7-12l21-38V28h-5v-8z" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M35 68h50l7 16a6 6 0 0 1-5 9H33a6 6 0 0 1-5-9l7-16z" fill="{{p1}}"/>
        <circle cx="52" cy="77" r="4" fill="{{accent}}"/>
        <circle cx="66" cy="82" r="3" fill="#ffffff" opacity="0.85"/>
        <circle cx="62" cy="56" r="3" fill="{{p2}}"/>
      `,
    },
    {
      id: "magic_mystic",
      label: "Magic, Tarot, Games & Curiosities",
      palette: "plum",
      phrases: ["crystal ball", "magic trick", "board game", "tarot deck", "alchemy potion"],
      keywords: ["magic", "wizard", "witch", "tarot", "potion", "alchemy", "wand", "crystal", "mystic", "ghost", "illusion", "juggling", "novelty", "prank", "weird", "curiosity", "relic", "unicorn", "dragon"],
      svg: `
        <circle cx="60" cy="52" r="30" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="60" cy="52" r="22" fill="{{p2}}" opacity="0.6"/>
        <path d="M34 86h52l-6 12H40l-6-12z" fill="{{ink}}" stroke="{{ink}}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M60 36l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="{{accent}}"/>
        <circle cx="48" cy="40" r="3.5" fill="#ffffff" opacity="0.8"/>
      `,
    },
    {
      id: "party_events",
      label: "Events, Weddings & Celebrations",
      palette: "amber",
      phrases: ["event planner", "party tent", "wedding decor", "birthday party"],
      keywords: ["event", "events", "wedding", "harusi", "party", "balloon", "balloons", "confetti", "tents", "pa system", "birthday", "anniversary", "decor", "stage", "trophy", "award"],
      svg: `
        <path d="M26 94L42 40l36 36-52 18z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M36 62l24 24M43 44l30 30" stroke="{{accent}}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="72" cy="30" r="7" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <circle cx="92" cy="46" r="5" fill="{{p2}}" stroke="{{ink}}" stroke-width="1.5"/>
        <path d="M54 22l4 8 8 2-6 6 1 8-7-4-7 4 1-8-6-6 8-2z" fill="#ef4444" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "gifts_hampers",
      label: "Gifts, Bouquets & Hampers",
      palette: "rose",
      phrases: ["gift box", "flower bouquet", "gift hamper", "valentine gift"],
      keywords: ["gift", "zawadi", "hamper", "bouquet", "flower", "roses", "surprise", "basket", "ribbon", "wrapped", "voucher"],
      svg: `
        <rect x="24" y="48" width="72" height="50" rx="8" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="20" y="36" width="80" height="16" rx="5" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5"/>
        <rect x="53" y="36" width="14" height="62" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
        <path d="M60 36c-14-2-22-14-14-19 7-4 14 7 14 19zm0 0c14-2 22-14 14-19-7-4-14 7-14 19z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2" stroke-linejoin="round"/>
      `,
    },
    {
      id: "shipping_logistics",
      label: "Courier, Parcels & Logistics",
      palette: "cobalt",
      phrases: ["parcel delivery", "moving truck", "express courier", "freight cargo"],
      keywords: ["delivery", "courier", "parcel", "package", "cargo", "freight", "shipping", "dispatch", "errand", "logistics", "warehouse", "wholesale", "bulk", "box"],
      svg: `
        <path d="M16 38h52v42H16V38z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M68 48h20l14 16v16H68V48z" fill="{{p2}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="35" cy="84" r="9" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="84" cy="84" r="9" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/>
        <path d="M30 56h24" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <rect x="74" y="54" width="14" height="10" rx="2" fill="#ffffff" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "legal_finance",
      label: "Consulting, Legal, Tax & Business",
      palette: "indigo",
      phrases: ["tax filing", "business registration", "legal advice", "kra pin"],
      keywords: ["consulting", "consultant", "legal", "lawyer", "advocate", "accounting", "tax", "kra", "audit", "finance", "insurance", "contract", "notary", "hr", "marketing", "strategy"],
      svg: `
        <path d="M44 34v-8a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v8" fill="none" stroke="{{ink}}" stroke-width="3.5"/>
        <rect x="18" y="34" width="84" height="60" rx="10" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M18 56c26 10 58 10 84 0" fill="{{p2}}" opacity="0.45" stroke="{{ink}}" stroke-width="2"/>
        <rect x="52" y="54" width="16" height="12" rx="3" fill="{{accent}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "sewing_craft",
      label: "Crafts, Yarn, Pottery & Leatherwork",
      palette: "terracotta",
      phrases: ["crochet yarn", "pottery wheel", "leather craft", "handmade craft"],
      keywords: ["crochet", "knit", "yarn", "wool", "sewing", "needle", "thread", "pottery", "clay", "ceramic", "vase", "leathercraft", "origami", "bead", "beads", "maasai", "craft", "macrame"],
      svg: `
        <path d="M44 26h32l-4 14c12 10 14 26 6 42l-4 14H46l-4-14c-8-16-6-32 6-42l-4-14z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M38 56h44M36 68h48" stroke="{{accent}}" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="60" cy="26" rx="16" ry="5" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/>
      `,
    },
    {
      id: "antique_collectible",
      label: "Collectibles, Clocks & Antiques",
      palette: "gold",
      phrases: ["vintage vinyl", "wall clock", "antique piece", "collector edition"],
      keywords: ["antique", "vintage", "collectible", "statue", "figurine", "clock", "coin", "stamp", "trophy", "medal", "retro", "classic", "artifact", "relic"],
      svg: `
        <path d="M36 24h48v22c0 14-10 26-24 26s-24-12-24-26V24z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M36 30H22c0 14 6 20 14 20M84 30h14c0 14-6 20-14 20" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/>
        <path d="M60 72v14M42 86h36l4 10H38l4-10z" fill="{{accent}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 36l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffffff"/>
      `,
    },
    {
      id: "umbrella_weather",
      label: "Umbrellas, Rain Gear & Shade",
      palette: "sky",
      phrases: ["rain coat", "garden umbrella", "shade net", "tarpaulin cover"],
      keywords: ["umbrella", "raincoat", "poncho", "tarpaulin", "canopy", "awning", "shade", "parasol"],
      svg: `
        <path d="M18 58c4-24 22-36 42-36s38 12 42 36c-10-6-18-6-28 0-10-6-18-6-28 0-10-6-18-6-28 0z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 22v62c0 8-12 8-12 0" fill="none" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 22c-10 10-14 22-14 36M60 22c10 10 14 22 14 36" fill="none" stroke="{{p2}}" stroke-width="2"/>
      `,
    },
    {
      id: "food_exotic_mushroom",
      label: "Artisanal Spices, Mushrooms & Herbs",
      palette: "plum",
      phrases: ["oyster mushroom", "truffle oil", "herbal tea", "exotic spice"],
      keywords: ["mushroom", "fungi", "truffle", "herb", "herbal", "spice", "kimchi", "fermented", "organic", "tea"],
      svg: `
        <path d="M22 58c4-22 20-34 38-34s34 12 38 34c-24 6-52 6-76 0z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M48 62v26c0 6 24 6 24 0V62" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <circle cx="44" cy="44" r="5" fill="#ffffff" opacity="0.88"/>
        <circle cx="64" cy="36" r="6" fill="{{accent}}"/>
        <circle cx="77" cy="48" r="4" fill="#ffffff" opacity="0.88"/>
      `,
    },
    {
      id: "umbrella_service_general",
      label: "Professional & Bookable Service",
      palette: "indigo",
      phrases: ["book service", "appointment booking", "custom service"],
      keywords: ["service", "appointment", "booking", "session", "consultation", "repair", "install", "maintenance", "support", "errand", "hire"],
      svg: `
        <rect x="20" y="28" width="80" height="68" rx="12" fill="#ffffff" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M20 40a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12v10H20V40z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M40 20v14M80 20v14" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>
        <path d="M46 70l10 10 20-20" fill="none" stroke="{{p1}}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="88" cy="78" r="7" fill="{{accent}}" stroke="{{ink}}" stroke-width="1.5"/>
      `,
    },
    {
      id: "product_artifact_general",
      label: "Custom & Specialty Product",
      palette: "emerald",
      phrases: ["featured item", "custom product", "special edition"],
      keywords: ["product", "item", "merch", "artifact", "widget", "gadget", "supply", "goods", "edition"],
      svg: `
        <path d="M60 18l36 20v44L60 102 24 82V38l36-20z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 18l36 20-36 20-36-20 36-20z" fill="{{p2}}"/>
        <path d="M60 58v44" stroke="{{ink}}" stroke-width="2.5"/>
        <path d="M42 28l36 20v14l-12-6v-14L30 22" fill="{{accent}}" opacity="0.92" stroke="{{ink}}" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="86" cy="24" r="5" fill="{{accent}}"/>
      `,
    },
  ];

  // Giant extra synonym expansion map covering obscure, technical, Swahili, and absurd concepts
  const TOKEN_EXPANSIONS = {
    viatu: "sneaker",
    kiatu: "sneaker",
    mkoba: "handbag",
    nguo: "shirt",
    simu: "smartphone",
    kompyuta: "laptop",
    picha: "camera",
    mziki: "music",
    chakula: "food",
    keki: "cake",
    kahawa: "coffee",
    chai: "tea",
    samaki: "fish",
    kuku: "chicken",
    mbuzi: "goat",
    ngombe: "cow",
    asali: "honey",
    dawa: "medicine",
    umeme: "electric",
    maji: "plumbing",
    rangi: "paint",
    mbao: "wood",
    vitabu: "book",
    nyumba: "house",
    gari: "car",
    nywele: "hair",
    harusi: "wedding",
    zawadi: "gift",
    baiskeli: "bicycle",
    usafi: "clean",
    kilimo: "farm",
    michezo: "game",
    taxidermy: "pet",
    kazoo: "guitar",
    ukulele: "guitar",
    theremin: "music",
    lightsaber: "rocket",
    phaser: "rocket",
    teleporter: "rocket",
    hoverboard: "bicycle",
    jetpack: "rocket",
    timecapsule: "antique",
    cryptid: "magic",
    chupacabra: "magic",
    tarantula: "pet",
    scorpion: "pet",
    beehive: "honey",
    terrarium: "plant",
    aquascape: "fish",
    blacksmith: "welding",
    swordsmith: "welding",
    alchemist: "magic",
    cauldron: "magic",
    spellbook: "magic",
    kaleidoscope: "glasses",
    accordion: "guitar",
    bagpipe: "guitar",
    boomerang: "camping",
    catapult: "antique",
    chandelier: "lamp",
    mannequin: "dress",
    megaphone: "microphone",
    trampoline: "gym",
    unicycle: "bicycle",
    kayak: "camping",
    paddleboard: "camping",
    surfboard: "camping",
    lava: "lamp",
    incense: "spa",
    crochet: "craft",
    macrame: "craft",
    origami: "craft",
    calligraphy: "paint",
    sculpture: "paint",
    fossil: "science",
    meteorite: "science",
    quantum: "rocket",
    hologram: "robot",
    cybernetic: "robot",
    exo: "robot",
    drone: "drone",
    boba: "drink",
    matcha: "coffee",
    kimchi: "mushroom",
    kombucha: "drink",
    sourdough: "bakery",
  };

  const BUSINESS_FALLBACKS = {
    FASHION: "shirt_apparel",
    BEAUTY: "skincare_beauty",
    ELECTRONICS: "smartphone",
    FURNITURE: "sofa_furniture",
    FOOD_BEVERAGE: "restaurant_food",
    HOSPITALITY: "restaurant_food",
    PHARMACY_HEALTH: "pharmacy_med",
    AGRICULTURE: "farm_livestock",
    AUTOMOTIVE: "car_auto",
    BUILDING_HARDWARE: "construction_tools",
    EDUCATION: "books_education",
    EVENTS_HOSPITALITY: "party_events",
    SPORTS_FITNESS: "fitness_gym",
    KIDS_BABY: "baby_kids",
    REAL_ESTATE: "real_estate",
    DIGITAL_TECH: "digital_software",
    LOGISTICS_DELIVERY: "shipping_logistics",
    WHOLESALE_B2B: "shipping_logistics",
    SERVICES: "umbrella_service_general",
    SERVICE: "umbrella_service_general",
  };

  const BY_ID = new Map(ARTWORK_DEFINITIONS.map((d) => [d.id, d]));

  function escapeXml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_/\\-]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    if (!text) return [];
    const base = text.split(" ").filter(Boolean);
    const out = [];
    for (const tok of base) {
      out.push(tok);
      if (tok.endsWith("ies") && tok.length > 4) out.push(tok.slice(0, -3) + "y");
      else if (tok.endsWith("es") && tok.length > 4) out.push(tok.slice(0, -2));
      else if (tok.endsWith("s") && tok.length > 3) out.push(tok.slice(0, -1));
      if (tok.endsWith("ing") && tok.length > 5) out.push(tok.slice(0, -3));
      const exp = TOKEN_EXPANSIONS[tok];
      if (exp) out.push(exp);
    }
    return Array.from(new Set(out));
  }

  function editDistanceSmall(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 2;
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          val = Math.min(val, dp[i - 2][j - 2] + 1);
        }
        dp[i][j] = val;
      }
    }
    return dp[a.length][b.length];
  }

  function scoreRule(text, tokens, rule, weight) {
    if (!text) return 0;
    let score = 0;
    for (const phrase of rule.phrases || []) {
      if (text.includes(phrase)) score += 12 * weight;
    }
    for (const kw of rule.keywords || []) {
      let best = 0;
      for (const tok of tokens) {
        if (tok === kw) best = Math.max(best, 8 * weight);
        else if (kw.length >= 4 && tok.length >= 4 && (tok.startsWith(kw) || kw.startsWith(tok))) {
          best = Math.max(best, 5.5 * weight);
        } else if (kw.length >= 4 && tok.length >= 6 && tok.includes(kw)) {
          best = Math.max(best, 4.5 * weight);
        } else if (kw.length >= 5 && tok.length >= 5 && editDistanceSmall(tok, kw) === 1) {
          best = Math.max(best, 3.5 * weight);
        }
      }
      score += best;
    }
    return score;
  }

  function hashTitle(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function resolveArtwork(item, context) {
    const it = item || {};
    const ctx = context || {};
    const explicitId = String(it.metadata?.artworkIcon || it.artworkIcon || ctx.artworkIcon || "").trim();
    if (explicitId && BY_ID.has(explicitId)) {
      const def = BY_ID.get(explicitId);
      return {
        id: def.id,
        label: def.label,
        palette: PALETTES[def.palette] || PALETTES.emerald,
        def,
        source: "manual",
      };
    }

    const titleText = normalizeText(`${it.title || ""} ${it.slug || ""}`);
    const catText = normalizeText(`${it.categoryName || ctx.categoryName || ""}`);
    const attrsText = normalizeText(
      it.attributes && typeof it.attributes === "object"
        ? Object.entries(it.attributes)
            .map(([k, v]) => `${k} ${v}`)
            .join(" ")
        : ""
    );
    const descText = normalizeText(it.description || "");
    const storeText = normalizeText(`${ctx.businessType || ""} ${ctx.storeName || ""}`);

    const titleTokens = tokenize(titleText);
    const catTokens = tokenize(catText);
    const attrTokens = tokenize(attrsText);
    const descTokens = tokenize(descText);
    const storeTokens = tokenize(storeText);

    let bestDef = null;
    let bestScore = 0;

    for (const def of ARTWORK_DEFINITIONS) {
      // Never pick generic catch-alls during semantic scoring
      if (def.id === "umbrella_service_general" || def.id === "product_artifact_general") continue;
      const score =
        scoreRule(titleText, titleTokens, def, 1.3) +
        scoreRule(catText, catTokens, def, 0.7) +
        scoreRule(attrsText, attrTokens, def, 0.45) +
        scoreRule(descText, descTokens, def, 0.35) +
        scoreRule(storeText, storeTokens, def, 0.15);
      if (score > bestScore) {
        bestScore = score;
        bestDef = def;
      }
    }

    if (bestDef && bestScore >= 2.5) {
      return {
        id: bestDef.id,
        label: bestDef.label,
        palette: PALETTES[bestDef.palette] || PALETTES.emerald,
        def: bestDef,
        source: "classified",
      };
    }

    // Tier 2: businessType fallback
    const btKey = String(ctx.businessType || it.store?.businessType || "").toUpperCase();
    if (BUSINESS_FALLBACKS[btKey] && BY_ID.has(BUSINESS_FALLBACKS[btKey])) {
      const btDef = BY_ID.get(BUSINESS_FALLBACKS[btKey]);
      return {
        id: btDef.id,
        label: btDef.label,
        palette: PALETTES[btDef.palette] || PALETTES.emerald,
        def: btDef,
        source: "business-fallback",
      };
    }

    // Tier 3: absurd / novel string -> pick deterministic palette & rich service/digital/product emblem
    const isService = String(it.itemType || "").toUpperCase() === "SERVICE";
    const isDigital = String(it.itemType || "").toUpperCase() === "DIGITAL";
    const fallbackId = isService
      ? "umbrella_service_general"
      : isDigital
      ? "digital_software"
      : "product_artifact_general";
    const def = BY_ID.get(fallbackId);
    const paletteNames = Object.keys(PALETTES);
    const seed = hashTitle(titleText || String(it.id || "item"));
    const palette = PALETTES[paletteNames[seed % paletteNames.length]] || PALETTES.emerald;

    return {
      id: def.id,
      label: isService ? "Specialized Service" : isDigital ? "Digital Item" : "Custom Item",
      palette,
      def,
      source: "universal-fallback",
    };
  }

  function renderSvgString(item, context, options) {
    const resolved = resolveArtwork(item, context);
    const pal = resolved.palette;
    const opts = options || {};
    const uid = `art_${hashTitle(`${resolved.id}_${item?.id || item?.title || ""}`)}`;
    const hydratedBody = resolved.def.svg
      .replace(/\{\{p1\}\}/g, pal.p1)
      .replace(/\{\{p2\}\}/g, pal.p2)
      .replace(/\{\{accent\}\}/g, pal.accent)
      .replace(/\{\{ink\}\}/g, pal.ink);
    const svgClass = opts.svgClass ? ` class="${escapeXml(opts.svgClass)}"` : "";
    const ariaLabel = escapeXml(opts.ariaLabel || `${item?.title || resolved.label} illustration`);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block;"${svgClass} role="img" aria-label="${ariaLabel}">
      <defs>
        <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.bg1}"/>
          <stop offset="100%" stop-color="${pal.bg2}"/>
        </linearGradient>
        <radialGradient id="${uid}_orb" cx="50%" cy="46%" r="48%">
          <stop offset="0%" stop-color="${pal.orb}" stop-opacity="0.48"/>
          <stop offset="100%" stop-color="${pal.orb}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#${uid}_bg)"/>
      <circle cx="60" cy="56" r="50" fill="url(#${uid}_orb)"/>
      <circle cx="20" cy="22" r="2.2" fill="${pal.p2}" opacity="0.4"/>
      <circle cx="98" cy="24" r="3" fill="${pal.accent}" opacity="0.35"/>
      <circle cx="100" cy="96" r="2.2" fill="${pal.p1}" opacity="0.3"/>
      <circle cx="22" cy="95" r="2.6" fill="${pal.p2}" opacity="0.35"/>
      ${hydratedBody}
    </svg>`;
  }

  function renderStageHtml(item, context, options) {
    const resolved = resolveArtwork(item, context);
    const opts = options || {};
    const compact = Boolean(opts.compact);
    const svgHtml = renderSvgString(item, context, { svgClass: "item-artwork-svg" });
    return `
      <div class="item-artwork-fallback${compact ? " is-compact" : ""}" data-artwork-id="${escapeXml(resolved.id)}" style="width:100%;height:100%;display:block;position:relative;overflow:hidden;">
        ${svgHtml}
      </div>
    `;
  }

  function buildDataUri(item, context) {
    const svg = renderSvgString(item, context).replace(/\s+/g, " ").trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function getCatalog() {
    return ARTWORK_DEFINITIONS.map((def) => ({
      id: def.id,
      label: def.label,
      palette: def.palette,
      keywords: [...(def.phrases || []), ...(def.keywords || [])],
    }));
  }

  function searchCatalog(queryText) {
    const q = normalizeText(queryText);
    if (!q) return getCatalog();
    return ARTWORK_DEFINITIONS.filter((def) => {
      if (def.id.includes(q) || normalizeText(def.label).includes(q)) return true;
      return [...(def.phrases || []), ...(def.keywords || [])].some((k) => normalizeText(k).includes(q));
    }).map((def) => ({
      id: def.id,
      label: def.label,
      palette: def.palette,
    }));
  }

  return {
    PALETTES,
    ARTWORK_DEFINITIONS,
    resolveArtwork,
    renderSvgString,
    renderStageHtml,
    buildDataUri,
    getCatalog,
    searchCatalog,
  };
});
