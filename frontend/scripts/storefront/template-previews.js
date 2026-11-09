// Public Gallery Mini Previews Generator

function buildMiniPreviewHtml(template) {
  const id = template.id;
  const subdomain = id.replace(/[^a-z0-9]/g, "");

  if (id === "cute-boutique") {
    return `
      <div class="mini-browserbar mini-cute-bar"><span class="mini-dots"><i class="dot-pink"></i><i class="dot-purple"></i><i class="dot-peach"></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-cute">Sweet Finds 💕</span></div>
      <div class="mini-hero cute-hero"><span class="mini-badge-pill">✨ SWEET FINDS &amp; GIFTS</span><strong class="mini-title">Little treasures that make you smile</strong><span class="mini-btn-pill">Shop cute finds 🌸</span></div>
      <div class="mini-products-grid cute-grid">
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-pink"></span><strong class="mini-card-name">Teddy Plush</strong><span class="mini-card-price">KES 1,200</span></div>
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-purple"></span><strong class="mini-card-name">Candy Mug</strong><span class="mini-card-price">KES 650</span></div>
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-peach"></span><strong class="mini-card-name">Pastel Journal</strong><span class="mini-card-price">KES 480</span></div>
      </div>`;
  }

  if (id === "food-local") {
    return `
      <div class="mini-canopy-stripe"></div>
      <div class="mini-browserbar mini-food-bar"><span class="mini-dots"><i class="dot-amber"></i><i class="dot-amber"></i><i class="dot-green"></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-food">Kitchen Live 🍲</span></div>
      <div class="mini-hero food-hero"><span class="mini-badge-warm">🔥 FRESH DAILY SPECIALS</span><strong class="mini-title">Taste the heart of local cooking</strong><span class="mini-btn-warm">Order takeaway 🥘</span></div>
      <div class="mini-menu-list">
        <div class="mini-menu-row"><span>Swahili Beef Biryani</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 650</b></div>
        <div class="mini-menu-row"><span>Coconut Fish Curry</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 800</b></div>
        <div class="mini-menu-row"><span>Fresh Hibiscus Zobo</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 200</b></div>
      </div>`;
  }

  if (id === "luxury-atelier") {
    return `
      <div class="mini-browserbar mini-luxury-bar"><span class="mini-dots"><i class="dot-gold"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-luxury">HAUTE ATELIER</span></div>
      <div class="mini-hero luxury-hero"><span class="mini-badge-gold">COLLECTION 2026</span><strong class="mini-title-serif">Timeless elegance, handcrafted in Nairobi.</strong><span class="mini-btn-hairline">Explore collection</span></div>
      <div class="mini-products-grid luxury-grid">
        <div class="mini-card-hairline"><span class="mini-card-img img-obsidian"></span><strong class="mini-card-name">Silk Kimono</strong><span class="mini-card-price">KES 14,500</span></div>
        <div class="mini-card-hairline"><span class="mini-card-img img-brass"></span><strong class="mini-card-name">Onyx Pendant</strong><span class="mini-card-price">KES 8,900</span></div>
        <div class="mini-card-hairline"><span class="mini-card-img img-taupe"></span><strong class="mini-card-name">Structured Tote</strong><span class="mini-card-price">KES 22,000</span></div>
      </div>`;
  }

  if (id === "brutalist-studio") {
    return `
      <div class="mini-browserbar brutalist-bar"><span class="mini-dots"><i class="dot-black"></i><i class="dot-black"></i><i class="dot-red"></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill brutalist-tag">DROP 04</span></div>
      <div class="mini-hero brutalist-hero"><span class="mini-badge-mono">NO COMPROMISE // NAIROBI</span><strong class="mini-title-heavy">STREETWEAR FOR THE UNAPOLOGETIC</strong><span class="mini-btn-brutal">GRAB DROP &rarr;</span></div>
      <div class="mini-products-grid brutalist-grid">
        <div class="mini-card-brutal"><span class="mini-card-img img-scarlet"></span><strong class="mini-card-name">HEAVY TEE</strong><span class="mini-card-price">KES 3,200</span></div>
        <div class="mini-card-brutal"><span class="mini-card-img img-mono"></span><strong class="mini-card-name">CARGO V2</strong><span class="mini-card-price">KES 5,800</span></div>
        <div class="mini-card-brutal"><span class="mini-card-img img-ink"></span><strong class="mini-card-name">CAP RAW</strong><span class="mini-card-price">KES 1,900</span></div>
      </div>`;
  }

  if (id === "tech-home") {
    return `
      <div class="mini-browserbar mini-tech-bar"><span class="mini-dots"><i class="dot-blue"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-tech">Bento Spec</span></div>
      <div class="mini-hero tech-hero"><span class="mini-badge-tech">SPEC-FIRST HARDWARE</span><strong class="mini-title">Next-Gen Audio &amp; Smart Living</strong><span class="mini-btn-tech">Compare specs</span></div>
      <div class="mini-products-grid tech-grid">
        <div class="mini-card-bento"><span class="mini-card-img img-slate"></span><span class="mini-spec-chip">4K &bull; 120Hz</span><strong class="mini-card-name">Monitor 27"</strong><span class="mini-card-price">KES 38,000</span></div>
        <div class="mini-card-bento"><span class="mini-card-img img-cyan"></span><span class="mini-spec-chip">ANC &bull; 40H</span><strong class="mini-card-name">Studio Pro</strong><span class="mini-card-price">KES 12,500</span></div>
        <div class="mini-card-bento"><span class="mini-card-img img-steel"></span><span class="mini-spec-chip">100W GaN</span><strong class="mini-card-name">Fast Hub</strong><span class="mini-card-price">KES 4,500</span></div>
      </div>`;
  }

  if (id === "service-studio") {
    return `
      <div class="mini-browserbar mini-service-bar"><span class="mini-dots"><i class="dot-clay"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-service">Appointments</span></div>
      <div class="mini-hero service-hero"><span class="mini-badge-service">CREATIVE &amp; CONSULTING</span><strong class="mini-title-serif">Space to create, expertise to guide.</strong><span class="mini-btn-service">Book session</span></div>
      <div class="mini-products-grid service-grid">
        <div class="mini-card-service"><div class="mini-accent-bar"></div><strong class="mini-card-name">Brand Audit</strong><small class="mini-meta">60 min video</small><span class="mini-card-price">KES 7,500</span></div>
        <div class="mini-card-service"><div class="mini-accent-bar"></div><strong class="mini-card-name">Photo Studio</strong><small class="mini-meta">Half-day hire</small><span class="mini-card-price">KES 18,000</span></div>
        <div class="mini-card-service"><div class="mini-accent-bar"></div><strong class="mini-card-name">Design Sprint</strong><small class="mini-meta">Full package</small><span class="mini-card-price">KES 45,000</span></div>
      </div>`;
  }

  if (id === "editorial-boutique") {
    return `
      <div class="mini-browserbar mini-editorial-bar"><span class="mini-dots"><i class="dot-oat"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-editorial">Lookbook</span></div>
      <div class="mini-hero editorial-hero"><span class="mini-badge-editorial">A CONSIDERED EDIT</span><strong class="mini-title-serif">A little more beautiful, every day.</strong><span class="mini-btn-editorial">Discover the edit</span></div>
      <div class="mini-products-grid editorial-grid">
        <div class="mini-card-editorial"><span class="mini-card-img img-oat"></span><strong class="mini-card-name">Linen Wrap</strong><span class="mini-card-price">KES 6,200</span></div>
        <div class="mini-card-editorial"><span class="mini-card-img img-mocha"></span><strong class="mini-card-name">Amber Vessel</strong><span class="mini-card-price">KES 3,800</span></div>
        <div class="mini-card-editorial"><span class="mini-card-img img-sage"></span><strong class="mini-card-name">Ceramic Cup</strong><span class="mini-card-price">KES 1,950</span></div>
      </div>`;
  }

  if (id === "fashion-beauty-cosmetics") {
    return `
      <div class="mini-browserbar mini-fashion-bar"><span class="mini-dots"><i class="dot-teal"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-fashion">Runway</span></div>
      <div class="mini-hero fashion-hero"><span class="mini-badge-fashion">THE NEW SEASON</span><strong class="mini-title-serif">Glow, radiance and editorial elegance.</strong><span class="mini-btn-fashion">Shop Beauty Edit</span></div>
      <div class="mini-products-grid fashion-grid">
        <div class="mini-card-fashion"><span class="mini-card-img img-blush"></span><strong class="mini-card-name">Glow Serum</strong><span class="mini-card-price">KES 3,400</span></div>
        <div class="mini-card-fashion"><span class="mini-card-img img-rose"></span><strong class="mini-card-name">Velvet Lip</strong><span class="mini-card-price">KES 1,850</span></div>
        <div class="mini-card-fashion"><span class="mini-card-img img-gold"></span><strong class="mini-card-name">Flora EDP</strong><span class="mini-card-price">KES 7,900</span></div>
      </div>`;
  }

  if (id === "premium-maker") {
    return `
      <div class="mini-browserbar mini-maker-bar"><span class="mini-dots"><i class="dot-bronze"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-maker">Artisan</span></div>
      <div class="mini-hero maker-hero"><span class="mini-badge-bronze">HANDCRAFTED IN KENYA</span><strong class="mini-title-serif">Form, weight, and lasting patience.</strong><span class="mini-btn-bronze">Explore workshop</span></div>
      <div class="mini-products-grid maker-grid">
        <div class="mini-card-maker"><span class="mini-card-img img-leather"></span><strong class="mini-card-name">Weekender Bag</strong><span class="mini-card-price">KES 16,500</span></div>
        <div class="mini-card-maker"><span class="mini-card-img img-brass"></span><strong class="mini-card-name">Brass Compass</strong><span class="mini-card-price">KES 4,200</span></div>
        <div class="mini-card-maker"><span class="mini-card-img img-wood"></span><strong class="mini-card-name">Olive Board</strong><span class="mini-card-price">KES 3,600</span></div>
      </div>`;
  }

  if (id === "bazaar-vibrant") {
    return `
      <div class="mini-browserbar mini-bazaar-bar"><span class="mini-dots"><i class="dot-orange"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-bazaar">Lively</span></div>
      <div class="mini-hero bazaar-hero"><span class="mini-badge-orange">🔥 KENYAN MARKET DEALS</span><strong class="mini-title-bold">Vibrant finds, fast dispatch everywhere</strong><span class="mini-btn-orange">Shop the Bazaar</span></div>
      <div class="mini-products-grid bazaar-grid">
        <div class="mini-card-bazaar"><span class="mini-card-img img-tangerine"></span><strong class="mini-card-name">Kiondo Tote</strong><span class="mini-card-price">KES 2,400</span></div>
        <div class="mini-card-bazaar"><span class="mini-card-img img-yellow"></span><strong class="mini-card-name">Beaded Wrap</strong><span class="mini-card-price">KES 1,500</span></div>
        <div class="mini-card-bazaar"><span class="mini-card-img img-spice"></span><strong class="mini-card-name">Safari Sandals</strong><span class="mini-card-price">KES 2,800</span></div>
      </div>`;
  }

  // Default: market-modern
  return `
    <div class="mini-browserbar mini-market-bar"><span class="mini-dots"><i class="dot-green"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-market">Verified</span></div>
    <div class="mini-hero market-hero"><span class="mini-badge-green">EVERYDAY SHOPPING</span><strong class="mini-title">Good things, chosen well.</strong><span class="mini-btn-green">Explore collection</span></div>
    <div class="mini-products-grid market-grid">
      <div class="mini-card-market"><span class="mini-card-img img-green"></span><strong class="mini-card-name">Canvas Tote</strong><span class="mini-card-price">KES 1,800</span></div>
      <div class="mini-card-market"><span class="mini-card-img img-leaf"></span><strong class="mini-card-name">Ceramic Mug</strong><span class="mini-card-price">KES 950</span></div>
      <div class="mini-card-market"><span class="mini-card-img img-earth"></span><strong class="mini-card-name">Soy Candle</strong><span class="mini-card-price">KES 1,400</span></div>
    </div>`;
}
