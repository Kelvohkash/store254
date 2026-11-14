export interface CategoryClassificationInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  parentName?: string | null;
  businessType?: string | null;
  storeName?: string | null;
}

export interface CategoryClassificationResult {
  icon: string;
  fallbackIcon: string;
  domain: string;
  confidence: number;
  source: "classified" | "context-fallback" | "universal-fallback";
  candidates: string[];
}

interface TaxonomyRule {
  id: string;
  icon: string;
  fallbackIcon: string;
  phrases: string[];
  keywords: string[];
  businessTypes?: string[];
}

const TAXONOMY_RULES: TaxonomyRule[] = [
  // Trades, Construction, Hardware & Engineering
  {
    id: "Plumbing & Pipework",
    icon: "wrench",
    fallbackIcon: "settings",
    phrases: ["plumbing", "pipe fitting", "water pump", "drain cleaning", "borehole", "septic tank", "bathroom fitting"],
    keywords: ["plumb", "plumber", "plumbing", "pipe", "faucet", "tap", "drain", "sewer", "sink", "toilet", "cistern", "valve", "geyser"],
  },
  {
    id: "Electrical & Wiring",
    icon: "plug",
    fallbackIcon: "zap",
    phrases: ["electrical", "circuit breaker", "house wiring", "power distribution", "switch gear", "led lighting"],
    keywords: ["electric", "electrician", "wire", "wiring", "socket", "switch", "breaker", "bulb", "floodlight", "conduit", "volt"],
  },
  {
    id: "Solar & Renewable Energy",
    icon: "sun",
    fallbackIcon: "zap",
    phrases: ["solar panel", "solar system", "solar inverter", "solar water", "backup power", "off grid"],
    keywords: ["solar", "photovoltaic", "inverter", "renewable", "sunpower"],
  },
  {
    id: "Carpentry & Woodwork",
    icon: "hammer",
    fallbackIcon: "wrench",
    phrases: ["carpentry", "wood work", "custom cabinet", "kitchen cabinet", "timber yard", "door frame"],
    keywords: ["carpenter", "carpentry", "wood", "timber", "plywood", "mdf", "mahogany", "cypress", "joinery", "cabinet", "saw"],
  },
  {
    id: "Hardware & Building Materials",
    icon: "hard-hat",
    fallbackIcon: "hammer",
    phrases: ["hardware", "building material", "iron sheet", "mabati", "jua kali", "power tool", "construction"],
    keywords: ["cement", "sand", "ballast", "steel", "mabati", "roofing", "nail", "bolt", "screw", "drill", "masonry", "tile", "tiles", "brick", "cabro", "fundi"],
  },
  {
    id: "Painting & Finishes",
    icon: "paint-roller",
    fallbackIcon: "paintbrush",
    phrases: ["interior painting", "wall paint", "spray paint", "gypsum ceiling", "wall paper"],
    keywords: ["paint", "painter", "primer", "varnish", "brush", "roller", "gypsum", "coating", "putty", "emulsion"],
  },
  {
    id: "Welding & Metal Fabrication",
    icon: "flame",
    fallbackIcon: "wrench",
    phrases: ["metal work", "steel gate", "welding", "window grille", "aluminium fabrication"],
    keywords: ["weld", "welder", "welding", "steel", "iron", "fabricat", "grille", "gate", "metal", "alloy"],
  },
  {
    id: "HVAC, Cooling & Appliances",
    icon: "snowflake",
    fallbackIcon: "fan",
    phrases: ["air condition", "cold room", "fridge repair", "ac service", "home appliance", "washing machine"],
    keywords: ["hvac", "ac", "cooling", "freezer", "fridge", "refrigerat", "ventilat", "fan", "heater", "microwave", "oven", "dispenser", "cooker"],
  },
  {
    id: "Security, CCTV & Locks",
    icon: "shield-check",
    fallbackIcon: "lock",
    phrases: ["cctv", "access control", "electric fence", "alarm system", "security guard", "smart lock", "biometric"],
    keywords: ["cctv", "camera", "surveillance", "alarm", "lock", "padlock", "key", "locksmith", "fence", "intercom", "safe", "guard", "security"],
  },
  {
    id: "Cleaning, Laundry & Pest Control",
    icon: "spray-can",
    fallbackIcon: "sparkles",
    phrases: ["dry clean", "carpet clean", "sofa clean", "house clean", "office clean", "pest control", "fumigation", "laundry"],
    keywords: ["clean", "cleaner", "laundry", "detergent", "soap", "fumigat", "pest", "sanitiz", "janitor", "mop", "vacuum", "wash"],
  },
  {
    id: "Landscaping & Gardening",
    icon: "trees",
    fallbackIcon: "sprout",
    phrases: ["lawn care", "garden design", "landscaping", "tree cutting", "outdoor plant", "potted plant"],
    keywords: ["landscape", "garden", "lawn", "flowerpot", "tree", "shrub", "grass", "hedge", "nursery", "planter"],
  },

  // Automotive, Transport & Logistics
  {
    id: "Automotive, Garages & Spare Parts",
    icon: "car",
    fallbackIcon: "wrench",
    phrases: ["spare part", "car wash", "auto garage", "wheel alignment", "car service", "car accessory", "tyre center", "oil change", "driving school"],
    keywords: ["car", "auto", "vehicle", "tyre", "tire", "rim", "brake", "engine", "oil", "battery", "garage", "mechanic", "bumper", "headlight", "motorbike", "boda", "motorcycle", "helmet"],
  },
  {
    id: "Logistics, Moving & Delivery",
    icon: "truck",
    fallbackIcon: "package",
    phrases: ["parcel delivery", "courier", "house moving", "relocation", "freight", "cargo", "same day delivery", "boda delivery"],
    keywords: ["deliver", "courier", "shipping", "freight", "cargo", "dispatch", "transport", "mover", "moving", "logistics", "haulage", "parcel"],
  },

  // Fashion, Footwear, Textiles & Accessories
  {
    id: "Footwear & Shoes",
    icon: "footprints",
    fallbackIcon: "shopping-bag",
    phrases: ["running shoe", "leather shoe", "official shoe", "high heel", "sports shoe", "school shoe"],
    keywords: ["shoe", "shoes", "footwear", "sneaker", "boot", "heel", "sandal", "loafer", "slipper", "crocs", "slide", "cleat", "trainer"],
  },
  {
    id: "Clothing, Boutique & Tailoring",
    icon: "shirt",
    fallbackIcon: "tag",
    phrases: ["mens wear", "womens wear", "official wear", "casual wear", "active wear", "african print", "kitenge", "mitumba", "wedding gown"],
    keywords: ["cloth", "clothes", "apparel", "shirt", "tshirt", "trouser", "jean", "pant", "dress", "skirt", "jacket", "hoodie", "suit", "blouse", "sweater", "coat", "fashion", "outfit", "mitumba", "mtumba", "kitenge", "ankara", "lingerie", "bra", "underwear", "sock", "uniform", "tailor"],
  },
  {
    id: "Bags, Backpacks & Luggage",
    icon: "briefcase",
    fallbackIcon: "shopping-bag",
    phrases: ["hand bag", "school bag", "travel bag", "laptop bag", "crossbody bag"],
    keywords: ["bag", "backpack", "purse", "wallet", "handbag", "tote", "luggage", "suitcase", "briefcase", "clutch", "duffel", "pouch"],
  },
  {
    id: "Jewelry, Watches & Luxury",
    icon: "gem",
    fallbackIcon: "watch",
    phrases: ["gold jewelry", "silver jewelry", "engagement ring", "wrist watch", "smart watch"],
    keywords: ["watch", "jewelry", "jewellery", "ring", "necklace", "bracelet", "earring", "gold", "silver", "diamond", "gem", "pearl", "anklet", "chain", "bangle"],
  },
  {
    id: "Eyewear & Optical",
    icon: "glasses",
    fallbackIcon: "eye",
    phrases: ["sun glasses", "reading glasses", "blue light", "contact lens", "eye clinic"],
    keywords: ["glasses", "sunglasses", "eyewear", "frame", "optician", "optical", "spectacle", "lens"],
  },

  // Baby, Kids & Maternity
  {
    id: "Baby, Infant & Maternity",
    icon: "baby",
    fallbackIcon: "heart",
    phrases: ["baby shop", "baby clothes", "baby care", "maternity wear", "baby gear", "newborn", "diaper", "feeding bottle"],
    keywords: ["baby", "infant", "toddler", "newborn", "diaper", "pampers", "stroller", "crib", "bassinet", "maternity", "onesie", "romper", "pacifier", "kid", "kids", "children", "nursery"],
  },
  {
    id: "Toys, Kids Games & Hobbies",
    icon: "gamepad-2",
    fallbackIcon: "sparkles",
    phrases: ["board game", "video game", "kids toy", "remote control", "play station", "xbox"],
    keywords: ["toy", "toys", "doll", "lego", "puzzle", "game", "gaming", "console", "ps5", "ps4", "xbox", "nintendo", "joystick", "rc"],
  },

  // Health, Medical, Wellness & Beauty
  {
    id: "Pharmacy, Medicine & Supplements",
    icon: "pill",
    fallbackIcon: "heart-pulse",
    phrases: ["pharmacy", "chemist", "over the counter", "first aid", "herbal medicine", "vitamin", "protein powder"],
    keywords: ["pharmacy", "chemist", "medicine", "drug", "pill", "tablet", "capsule", "syrup", "vitamin", "supplement", "herbal", "ointment", "bandage", "antiseptic"],
  },
  {
    id: "Clinic, Medical & Dental Care",
    icon: "stethoscope",
    fallbackIcon: "heart-pulse",
    phrases: ["dental clinic", "medical clinic", "doctor consultation", "lab test", "diagnostic", "physio therapy", "maternity clinic"],
    keywords: ["clinic", "hospital", "doctor", "nurse", "dental", "dentist", "tooth", "teeth", "medical", "health", "therapy", "checkup", "xray", "ultrasound", "lab", "blood"],
  },
  {
    id: "Hair Salon, Braids & Wigs",
    icon: "sparkles",
    fallbackIcon: "scissors",
    phrases: ["hair salon", "human hair", "braids", "locs", "silk press", "hair care", "hair oil", "wig install"],
    keywords: ["hair", "salon", "braid", "wig", "weave", "extension", "lace", "shampoo", "conditioner", "dreadlock", "retouch", "relaxer", "curls", "bonnet"],
  },
  {
    id: "Barber & Men Grooming",
    icon: "scissors",
    fallbackIcon: "sparkles",
    phrases: ["barber shop", "kinyozi", "beard oil", "haircut", "grooming kit"],
    keywords: ["barber", "kinyozi", "fade", "shave", "beard", "clipper", "trimmer", "razor", "grooming", "haircut"],
  },
  {
    id: "Skincare, Nails & Cosmetics",
    icon: "flower-2",
    fallbackIcon: "sparkles",
    phrases: ["skin care", "nail bar", "gel polish", "make up", "facial treatment", "body lotion", "lip gloss"],
    keywords: ["nail", "manicure", "pedicure", "acrylic", "makeup", "cosmetic", "lipstick", "foundation", "mascara", "skincare", "facial", "serum", "cleanser", "lotion", "cream", "sunscreen", "moisturizer", "toner"],
  },
  {
    id: "Perfumes & Fragrances",
    icon: "droplets",
    fallbackIcon: "sparkles",
    phrases: ["body mist", "arabian oud", "essential oil", "scented candle"],
    keywords: ["perfume", "cologne", "fragrance", "scent", "oud", "deodorant", "mist", "aroma"],
  },
  {
    id: "Spa, Massage & Wellness",
    icon: "heart-pulse",
    fallbackIcon: "sparkles",
    phrases: ["deep tissue", "thai massage", "spa package", "sauna", "steam bath", "mental health", "counseling"],
    keywords: ["massage", "spa", "wellness", "relax", "aromatherapy", "reflexology", "sauna", "chiropractic", "counsel"],
  },
  {
    id: "Fitness, Gym & Sports",
    icon: "dumbbell",
    fallbackIcon: "activity",
    phrases: ["gym membership", "personal trainer", "home gym", "yoga mat", "football boot", "sports gear"],
    keywords: ["gym", "fitness", "workout", "dumbbell", "barbell", "weight", "treadmill", "yoga", "pilates", "sport", "football", "basketball", "tennis", "cycling", "swim", "jersey", "athletic"],
  },

  // Food, Beverage, Grocery & Hospitality
  {
    id: "Bakery, Cakes & Pastries",
    icon: "cake-slice",
    fallbackIcon: "utensils",
    phrases: ["birthday cake", "wedding cake", "cup cake", "bakery", "pastry", "cinnamon roll", "artisan bread"],
    keywords: ["cake", "bakery", "bake", "bread", "pastry", "muffin", "cupcake", "donut", "croissant", "cookie", "biscuit", "pie", "tart", "chapati", "mandazi", "scone"],
  },
  {
    id: "Coffee, Tea & Cafe",
    icon: "coffee",
    fallbackIcon: "cup-soda",
    phrases: ["coffee shop", "espresso", "bubble tea", "herbal tea", "breakfast cafe"],
    keywords: ["coffee", "espresso", "latte", "cappuccino", "tea", "chai", "matcha", "cafe", "roast", "barista", "cocoa"],
  },
  {
    id: "Restaurant, Fast Food & Catering",
    icon: "utensils",
    fallbackIcon: "shopping-basket",
    phrases: ["nyama choma", "fast food", "outside catering", "meal prep", "lunch box", "swahili dish", "african dish"],
    keywords: ["restaurant", "food", "meal", "catering", "dinner", "lunch", "breakfast", "burger", "pizza", "chicken", "biryani", "pilau", "ugali", "rice", "stew", "grill", "snack", "takeaway", "menu", "kitchen"],
  },
  {
    id: "Butchery, Meat & Seafood",
    icon: "beef",
    fallbackIcon: "utensils",
    phrases: ["meat shop", "beef steak", "pork ribs", "fresh fish", "sea food"],
    keywords: ["butcher", "butchery", "meat", "beef", "goat", "mutton", "lamb", "pork", "sausage", "bacon", "fillet", "fish", "tilapia", "salmon", "prawn", "seafood", "poultry"],
  },
  {
    id: "Fresh Produce, Fruits & Groceries",
    icon: "shopping-basket",
    fallbackIcon: "apple",
    phrases: ["mama mboga", "fresh fruit", "fresh vegetable", "organic grocery", "mini mart", "dry cereals", "posho mill"],
    keywords: ["grocery", "groceries", "supermarket", "minimart", "fruit", "vegetable", "mboga", "tomato", "onion", "potato", "avocado", "mango", "banana", "cereal", "flour", "maize", "beans", "sugar", "spice", "honey", "milk", "egg", "dairy"],
  },
  {
    id: "Juices, Water & Cold Drinks",
    icon: "cup-soda",
    fallbackIcon: "coffee",
    phrases: ["fresh juice", "smoothie", "drinking water", "soft drink", "energy drink"],
    keywords: ["juice", "smoothie", "soda", "water", "beverage", "drink", "milkshake", "yogurt"],
  },
  {
    id: "Wines, Spirits & Liquor Store",
    icon: "wine",
    fallbackIcon: "cup-soda",
    phrases: ["wines and spirits", "liquor store", "craft beer", "cocktail bar"],
    keywords: ["wine", "spirit", "whisky", "whiskey", "vodka", "gin", "rum", "beer", "liquor", "champagne", "tequila", "brandy", "cider", "bar"],
  },

  // Tech, Electronics, Computing & Telecom
  {
    id: "Phones, Tablets & Accessories",
    icon: "smartphone",
    fallbackIcon: "tablet",
    phrases: ["smart phone", "phone case", "screen protector", "phone repair", "mobile phone", "airtime"],
    keywords: ["phone", "smartphone", "iphone", "samsung", "tecno", "infinix", "xiaomi", "oppo", "redmi", "pixel", "tablet", "ipad", "sim", "tempered", "magsafe"],
  },
  {
    id: "Computers, Laptops & Office IT",
    icon: "laptop",
    fallbackIcon: "monitor",
    phrases: ["laptop repair", "desktop pc", "gaming pc", "office printer", "cyber cafe"],
    keywords: ["laptop", "macbook", "computer", "pc", "desktop", "keyboard", "mouse", "ssd", "ram", "harddisk", "flashdrive", "printer", "toner", "cartridge", "scanner", "workstation"],
  },
  {
    id: "Audio, Headphones & Speakers",
    icon: "headphones",
    fallbackIcon: "music",
    phrases: ["bluetooth speaker", "wireless earbud", "studio mic", "sound system", "home theater", "pa system"],
    keywords: ["headphone", "earphone", "earbud", "airpod", "speaker", "woofer", "subwoofer", "soundbar", "microphone", "audio", "hifi", "dj"],
  },
  {
    id: "TVs, Screens & Projectors",
    icon: "tv",
    fallbackIcon: "monitor",
    phrases: ["smart tv", "oled tv", "tv stand", "projector screen"],
    keywords: ["tv", "television", "screen", "monitor", "display", "projector", "decoder", "androidbox"],
  },
  {
    id: "Power Banks, Chargers & Adapters",
    icon: "battery-charging",
    fallbackIcon: "zap",
    phrases: ["power bank", "fast charger", "type c cable", "extension cable", "ups backup", "voltage stabilizer"],
    keywords: ["charger", "charging", "powerbank", "cable", "adapter", "usb", "ups", "extension", "battery"],
  },
  {
    id: "Networking, WiFi & Smart Home",
    icon: "wifi",
    fallbackIcon: "cpu",
    phrases: ["wifi router", "fiber internet", "starlink", "smart home", "ethernet cable"],
    keywords: ["wifi", "router", "modem", "network", "lan", "starlink", "hotspot", "iot", "alexa", "switch", "internet"],
  },
  {
    id: "Photography, Video & Drones",
    icon: "camera",
    fallbackIcon: "video",
    phrases: ["photo shoot", "wedding photography", "video production", "drone service", "ring light"],
    keywords: ["camera", "lens", "tripod", "gimbal", "drone", "dslr", "photography", "videography", "studio", "photoshoot", "vlog"],
  },
  {
    id: "Software, Web & Digital Services",
    icon: "code",
    fallbackIcon: "globe",
    phrases: ["web design", "mobile app", "software development", "cloud hosting", "digital product", "e-book", "template", "ui ux", "seo"],
    keywords: ["software", "code", "coding", "web", "website", "app", "cloud", "api", "saas", "wordpress", "shopify", "hosting", "domain", "cyber", "it", "tech", "ai", "automation"],
  },

  // Home, Living, Furniture & Real Estate
  {
    id: "Real Estate, Rentals & Airbnbs",
    icon: "home",
    fallbackIcon: "building-2",
    phrases: ["house for rent", "apartment to let", "airbnb", "furnished studio", "bedsitter", "real estate", "gated community", "holiday home"],
    keywords: ["apartment", "house", "home", "bedsitter", "studio", "villa", "maisonette", "bungalow", "flat", "rental", "letting", "airbnb", "hostel", "estate", "tenant", "hotel", "lodge"],
  },
  {
    id: "Land, Plots & Commercial Property",
    icon: "map-pin",
    fallbackIcon: "building-2",
    phrases: ["plot for sale", "commercial space", "office space", "warehouse space", "godown", "shop to let"],
    keywords: ["land", "plot", "acre", "hectare", "commercial", "office", "warehouse", "godown", "stall", "property", "title"],
  },
  {
    id: "Furniture, Sofas & Mattresses",
    icon: "armchair",
    fallbackIcon: "bed-double",
    phrases: ["living room", "dining set", "office chair", "office desk", "recliner sofa", "orthopedic mattress"],
    keywords: ["furniture", "sofa", "couch", "chair", "table", "desk", "bed", "mattress", "wardrobe", "shelf", "bookshelf", "stool", "ottoman", "decor", "cushion", "curtain", "rug", "carpet"],
  },
  {
    id: "Kitchenware, Cookware & Dining",
    icon: "cooking-pot",
    fallbackIcon: "utensils",
    phrases: ["kitchen ware", "non stick", "dinner set", "flask", "sufuria"],
    keywords: ["kitchenware", "cookware", "pot", "pan", "sufuria", "kettle", "blender", "plate", "cup", "mug", "cutlery", "spoon", "knife", "thermos", "bottle", "tupperware"],
  },
  {
    id: "Lighting, Lamps & Interior Design",
    icon: "lamp",
    fallbackIcon: "palette",
    phrases: ["chandelier", "interior design", "pendant light", "bedside lamp"],
    keywords: ["lamp", "chandelier", "lantern", "interior", "decor", "vase", "mirror", "frame", "curtain"],
  },

  // Professional Services, Business, Education & Events
  {
    id: "Finance, Accounting & M-Pesa Agency",
    icon: "landmark",
    fallbackIcon: "calculator",
    phrases: ["tax filing", "kra return", "book keeping", "audit", "mpesa agent", "loan", "sacco", "insurance"],
    keywords: ["finance", "accounting", "tax", "kra", "audit", "bookkeep", "bank", "sacco", "loan", "credit", "insurance", "invest", "payroll", "mpesa", "forex", "crypto"],
  },
  {
    id: "Legal, Advocates & Compliance",
    icon: "scale",
    fallbackIcon: "file-text",
    phrases: ["law firm", "legal advice", "company registration", "conveyancing", "affidavit", "notary"],
    keywords: ["legal", "law", "lawyer", "advocate", "attorney", "contract", "notary", "court", "compliance", "patent", "trademark"],
  },
  {
    id: "Marketing, Design & Printing",
    icon: "megaphone",
    fallbackIcon: "printer",
    phrases: ["graphic design", "social media", "digital marketing", "branding", "t-shirt printing", "banner printing", "business card"],
    keywords: ["marketing", "advert", "branding", "logo", "poster", "flyer", "banner", "brochure", "print", "printing", "embroidery", "screenprint", "signage", "merch", "seo", "pr"],
  },
  {
    id: "Books, Stationery & School Supplies",
    icon: "book-open",
    fallbackIcon: "pen-tool",
    phrases: ["book shop", "stationery", "text book", "exercise book", "office supply", "art supply"],
    keywords: ["book", "novel", "stationery", "pen", "pencil", "notebook", "diary", "paper", "envelope", "folder", "textbook", "library", "art", "craft", "canvas"],
  },
  {
    id: "Education, Training & Courses",
    icon: "graduation-cap",
    fallbackIcon: "book-open",
    phrases: ["online course", "tuition", "computer class", "bootcamp", "music lesson", "language class", "catering school"],
    keywords: ["course", "class", "school", "college", "academy", "training", "tutor", "tuition", "workshop", "coaching", "seminar", "certificate", "diploma", "lesson"],
  },
  {
    id: "Events, Weddings & Rentals",
    icon: "calendar",
    fallbackIcon: "sparkles",
    phrases: ["event planning", "tent hire", "wedding decor", "mc service", "party supply", "birthday decor", "public address"],
    keywords: ["event", "wedding", "bridal", "party", "celebration", "tent", "canopy", "decor", "balloon", "confetti", "banquet", "conference", "dj", "mc", "usher"],
  },
  {
    id: "Music, Instruments & Entertainment",
    icon: "music",
    fallbackIcon: "headphones",
    phrases: ["musical instrument", "guitar", "keyboard piano", "recording studio"],
    keywords: ["music", "guitar", "piano", "drum", "violin", "instrument", "record", "song", "beat", "band"],
  },
  {
    id: "Travel, Tours & Safaris",
    icon: "plane",
    fallbackIcon: "compass",
    phrases: ["tour package", "safari", "flight booking", "airport transfer", "visa assistance", "travel agency"],
    keywords: ["travel", "tour", "safari", "flight", "ticket", "visa", "passport", "resort", "excursion", "beach", "holiday", "camping"],
  },

  // Agriculture, Agrovet & Pets
  {
    id: "Farming, Seeds & Agrovet",
    icon: "sprout",
    fallbackIcon: "tractor",
    phrases: ["agrovet", "animal feed", "certified seed", "drip irrigation", "green house", "dairy meal", "poultry feed"],
    keywords: ["farm", "agro", "agrovet", "seed", "seedling", "fertilizer", "manure", "pesticide", "irrigation", "greenhouse", "harvest", "tractor", "feed", "chick", "dairy", "livestock"],
  },
  {
    id: "Pets, Veterinary & Pet Supplies",
    icon: "paw-print",
    fallbackIcon: "heart",
    phrases: ["pet shop", "dog food", "cat food", "vet clinic", "pet grooming"],
    keywords: ["pet", "dog", "puppy", "cat", "kitten", "vet", "veterinary", "collar", "leash", "aquarium", "fishfood", "bird"],
  },
  {
    id: "Wholesale, Bulk & Industrial",
    icon: "boxes",
    fallbackIcon: "package",
    phrases: ["whole sale", "bulk order", "factory direct", "distributor", "packaging material"],
    keywords: ["wholesale", "bulk", "carton", "bale", "distributor", "industrial", "packaging", "box", "polythene", "sack"],
  },
  {
    id: "Gifts, Florist & Hampers",
    icon: "gift",
    fallbackIcon: "heart",
    phrases: ["gift hamper", "flower bouquet", "gift box", "valentine", "corporate gift"],
    keywords: ["gift", "hamper", "bouquet", "florist", "rose", "chocolate", "souvenir", "card", "wrap"],
  },
];

const TOKEN_SYNONYMS: Record<string, string[]> = {
  kinyozi: ["barber", "haircut"],
  mtumba: ["clothing", "fashion"],
  mitumba: ["clothing", "fashion"],
  duka: ["grocery", "supermarket"],
  mboga: ["vegetable", "grocery"],
  choma: ["meat", "restaurant"],
  nyama: ["meat", "butchery"],
  boda: ["motorcycle", "courier"],
  bodaboda: ["motorcycle", "courier"],
  fundi: ["repair", "plumber", "carpenter"],
  mabati: ["roofing", "hardware"],
  chemist: ["pharmacy", "medicine"],
  clinic: ["medical", "doctor"],
  posho: ["flour", "cereal"],
  matatu: ["transport", "vehicle"],
  bedsitter: ["apartment", "rental"],
  salon: ["hair", "beauty"],
  kitenge: ["fabric", "dress"],
  ankara: ["fabric", "dress"],
  sufuria: ["cookware", "kitchen"],
};

function normalizeText(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  if (!text) return [];
  const raw = text.split(" ").filter(Boolean);
  const expanded: string[] = [];
  for (const tok of raw) {
    expanded.push(tok);
    if (tok.endsWith("ies") && tok.length > 4) expanded.push(tok.slice(0, -3) + "y");
    else if (tok.endsWith("es") && tok.length > 4) expanded.push(tok.slice(0, -2));
    else if (tok.endsWith("s") && tok.length > 3) expanded.push(tok.slice(0, -1));
    const syn = TOKEN_SYNONYMS[tok];
    if (syn) expanded.push(...syn);
  }
  return Array.from(new Set(expanded));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
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

function scoreField(
  text: string,
  tokens: string[],
  rule: TaxonomyRule,
  weight: number
): number {
  if (!text) return 0;
  let score = 0;

  for (const phrase of rule.phrases) {
    if (text.includes(phrase)) {
      score += 10 * weight;
    }
  }

  for (const kw of rule.keywords) {
    let bestKeywordScore = 0;
    for (const tok of tokens) {
      if (tok === kw) {
        bestKeywordScore = Math.max(bestKeywordScore, 7 * weight);
      } else if (kw.length >= 4 && tok.length >= 4 && (tok.startsWith(kw) || kw.startsWith(tok))) {
        bestKeywordScore = Math.max(bestKeywordScore, 5 * weight);
      } else if (kw.length >= 5 && tok.length >= 5 && editDistance(tok, kw) === 1) {
        bestKeywordScore = Math.max(bestKeywordScore, 3.5 * weight);
      }
    }
    score += bestKeywordScore;
  }

  return score;
}

const BUSINESS_TYPE_FALLBACKS: Record<string, { icon: string; fallbackIcon: string; domain: string }> = {
  SERVICE: { icon: "briefcase", fallbackIcon: "calendar", domain: "Professional Services" },
  SERVICES: { icon: "briefcase", fallbackIcon: "calendar", domain: "Professional Services" },
  REAL_ESTATE: { icon: "building-2", fallbackIcon: "home", domain: "Real Estate & Property" },
  DIGITAL: { icon: "code", fallbackIcon: "globe", domain: "Digital & Tech" },
  DIGITAL_TECH: { icon: "code", fallbackIcon: "globe", domain: "Digital Products & Tech" },
  ELECTRONICS: { icon: "smartphone", fallbackIcon: "cpu", domain: "Electronics & Appliances" },
  FASHION: { icon: "shirt", fallbackIcon: "shopping-bag", domain: "Fashion, Clothing & Footwear" },
  BEAUTY: { icon: "sparkles", fallbackIcon: "scissors", domain: "Beauty, Salon & Wellness" },
  FURNITURE: { icon: "sofa", fallbackIcon: "lamp", domain: "Furniture & Home Decor" },
  HOSPITALITY: { icon: "utensils", fallbackIcon: "coffee", domain: "Food & Hospitality" },
  FOOD: { icon: "utensils", fallbackIcon: "coffee", domain: "Food & Hospitality" },
  FOOD_BEVERAGE: { icon: "utensils", fallbackIcon: "coffee", domain: "Food, Dining & Groceries" },
  PHARMACY_HEALTH: { icon: "heart-pulse", fallbackIcon: "pill", domain: "Pharmacy, Health & Clinic" },
  AUTOMOTIVE: { icon: "car", fallbackIcon: "wrench", domain: "Auto Spares & Motors" },
  AGRICULTURE: { icon: "sprout", fallbackIcon: "wheat", domain: "Agrovets & Farming" },
  BUILDING_HARDWARE: { icon: "hammer", fallbackIcon: "wrench", domain: "Building Materials & Hardware" },
  EDUCATION: { icon: "graduation-cap", fallbackIcon: "book-open", domain: "Books & Education" },
  EVENTS_HOSPITALITY: { icon: "camera", fallbackIcon: "calendar", domain: "Events, Media & Hospitality" },
  SPORTS_FITNESS: { icon: "dumbbell", fallbackIcon: "trophy", domain: "Sports & Fitness" },
  KIDS_BABY: { icon: "baby", fallbackIcon: "gift", domain: "Baby, Kids & Toys" },
  WHOLESALE_B2B: { icon: "boxes", fallbackIcon: "truck", domain: "Wholesale & Suppliers" },
  LOGISTICS_DELIVERY: { icon: "truck", fallbackIcon: "map-pin", domain: "Courier & Logistics" },
};

function businessTypeFallback(businessType?: string | null): { icon: string; fallbackIcon: string; domain: string } {
  const bt = String(businessType || "").toUpperCase();
  return BUSINESS_TYPE_FALLBACKS[bt] || { icon: "package", fallbackIcon: "tag", domain: "General Retail" };
}

export function classifyCategoryIcon(input: CategoryClassificationInput): CategoryClassificationResult {
  const nameText = normalizeText(`${input.name || ""} ${input.slug || ""}`);
  const descText = normalizeText(input.description);
  const parentText = normalizeText(input.parentName);
  const storeText = normalizeText(`${input.storeName || ""} ${input.businessType || ""}`);

  const nameTokens = tokenize(nameText);
  const descTokens = tokenize(descText);
  const parentTokens = tokenize(parentText);
  const storeTokens = tokenize(storeText);

  let bestRule: TaxonomyRule | null = null;
  let bestScore = 0;
  let secondRule: TaxonomyRule | null = null;

  for (const rule of TAXONOMY_RULES) {
    const score =
      scoreField(nameText, nameTokens, rule, 1.0) +
      scoreField(descText, descTokens, rule, 0.45) +
      scoreField(parentText, parentTokens, rule, 0.35) +
      scoreField(storeText, storeTokens, rule, 0.2);

    if (score > bestScore) {
      secondRule = bestRule;
      bestScore = score;
      bestRule = rule;
    }
  }

  if (bestRule && bestScore >= 2.5) {
    const candidates = Array.from(
      new Set([
        bestRule.icon,
        bestRule.fallbackIcon,
        secondRule?.icon || "tag",
        "package",
        "tag",
      ])
    );
    return {
      icon: bestRule.icon,
      fallbackIcon: bestRule.fallbackIcon,
      domain: bestRule.id,
      confidence: Math.min(1, Number((bestScore / 12).toFixed(2))),
      source: "classified",
      candidates,
    };
  }

  const btFallback = businessTypeFallback(input.businessType);
  if (input.businessType) {
    return {
      icon: btFallback.icon,
      fallbackIcon: btFallback.fallbackIcon,
      domain: btFallback.domain,
      confidence: 0.35,
      source: "context-fallback",
      candidates: [btFallback.icon, btFallback.fallbackIcon, "tag", "package"],
    };
  }

  return {
    icon: "package",
    fallbackIcon: "tag",
    domain: "General Catalog",
    confidence: 0.2,
    source: "universal-fallback",
    candidates: ["package", "tag", "layers"],
  };
}
