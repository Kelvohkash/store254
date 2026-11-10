// Public Gallery Mini Previews Generator

function buildMiniPreviewHtml(template) {
  const id = template.id;
  const subdomain = id.replace(/[^a-z0-9]/g, "");

  if (id === "fashion-and-design") {
    return `
      <div class="mini-browserbar mini-editorial-bar"><span class="mini-dots"><i class="dot-oat"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-editorial">Boutique Atelier</span></div>
      <div class="mini-hero editorial-hero"><span class="mini-badge-editorial">NAIROBI BESPOKE COUTURE</span><strong class="mini-title-serif">Modern Heritage, Tailored in Nairobi.</strong><span class="mini-btn-editorial">Explore Lookbook</span></div>
      <div class="mini-products-grid editorial-grid">
        <div class="mini-card-editorial"><span class="mini-card-img img-oat"></span><strong class="mini-card-name">Ankara Midi Dress</strong><span class="mini-card-price">KES 4,200</span></div>
        <div class="mini-card-editorial"><span class="mini-card-img img-mocha"></span><strong class="mini-card-name">Maasai Sandals</strong><span class="mini-card-price">KES 2,400</span></div>
        <div class="mini-card-editorial"><span class="mini-card-img img-sage"></span><strong class="mini-card-name">Streetwear Bomber</strong><span class="mini-card-price">KES 3,800</span></div>
      </div>`;
  }

  if (id === "cosmetics") {
    return `
      <div class="mini-browserbar mini-cute-bar"><span class="mini-dots"><i class="dot-pink"></i><i class="dot-purple"></i><i class="dot-peach"></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-cute">Glow Studio ✨</span></div>
      <div class="mini-hero cute-hero"><span class="mini-badge-pill">✨ MELANIN GLOW BEAUTY</span><strong class="mini-title">Radiant Skin, Crown Wigs &amp; Glamour</strong><span class="mini-btn-pill">Shop Beauty Finds 🌸</span></div>
      <div class="mini-products-grid cute-grid">
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-pink"></span><strong class="mini-card-name">Glow Vitamin C Serum</strong><span class="mini-card-price">KES 2,450</span></div>
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-purple"></span><strong class="mini-card-name">HD Frontal Wig 24"</strong><span class="mini-card-price">KES 18,500</span></div>
        <div class="mini-card-bubbly"><span class="mini-card-img img-pastel-peach"></span><strong class="mini-card-name">Matte Lip Trio Set</strong><span class="mini-card-price">KES 1,950</span></div>
      </div>`;
  }

  if (id === "electronics") {
    return `
      <div class="mini-browserbar mini-tech-bar"><span class="mini-dots"><i class="dot-blue"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-tech">24M Warranty ⚡</span></div>
      <div class="mini-hero tech-hero"><span class="mini-badge-tech">SPEC-FIRST HARDWARE</span><strong class="mini-title">Phones, Laptops &amp; Smart Living</strong><span class="mini-btn-tech">Browse Specs</span></div>
      <div class="mini-products-grid tech-grid">
        <div class="mini-card-bento"><span class="mini-card-img img-cyan"></span><span class="mini-spec-chip">5G &bull; 256GB</span><strong class="mini-card-name">Samsung Galaxy A55</strong><span class="mini-card-price">KES 48,500</span></div>
        <div class="mini-card-bento"><span class="mini-card-img img-slate"></span><span class="mini-spec-chip">4K UHD &bull; 55"</span><strong class="mini-card-name">Hisense Smart TV</strong><span class="mini-card-price">KES 54,000</span></div>
        <div class="mini-card-bento"><span class="mini-card-img img-steel"></span><span class="mini-spec-chip">ANC &bull; 30H</span><strong class="mini-card-name">Oraimo FreePods 4</strong><span class="mini-card-price">KES 4,200</span></div>
      </div>`;
  }

  if (id === "houses-and-rentals") {
    return `
      <div class="mini-browserbar mini-service-bar"><span class="mini-dots"><i class="dot-teal"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-fashion">Vacant Units 🏡</span></div>
      <div class="mini-hero service-hero"><span class="mini-badge-service">RESIDENTIAL &amp; SHORT-STAYS</span><strong class="mini-title-serif">Apartments, Bedsitters &amp; Airbnbs</strong><span class="mini-btn-service">Book Viewing</span></div>
      <div class="mini-products-grid service-grid">
        <div class="mini-card-service"><div class="mini-accent-bar" style="background:#0f766e"></div><strong class="mini-card-name">Kilimani 2BR Apt</strong><small class="mini-meta">Balcony &bull; Gym</small><span class="mini-card-price" style="color:#0f766e">KES 65,000/mo</span></div>
        <div class="mini-card-service"><div class="mini-accent-bar" style="background:#0f766e"></div><strong class="mini-card-name">Executive Bedsitter</strong><small class="mini-meta">Roysambu &bull; Wi-Fi</small><span class="mini-card-price" style="color:#0f766e">KES 16,500/mo</span></div>
        <div class="mini-card-service"><div class="mini-accent-bar" style="background:#0f766e"></div><strong class="mini-card-name">Nyali Pool Airbnb</strong><small class="mini-meta">Mombasa &bull; AC</small><span class="mini-card-price" style="color:#0f766e">KES 6,500/night</span></div>
      </div>`;
  }

  if (id === "real-estate") {
    return `
      <div class="mini-browserbar mini-luxury-bar"><span class="mini-dots"><i class="dot-gold"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-luxury">Ready Title Deeds 📜</span></div>
      <div class="mini-hero luxury-hero"><span class="mini-badge-gold">FREE DAILY SITE VISITS</span><strong class="mini-title-serif">Prime Land &amp; Luxury Homes Across Kenya</strong><span class="mini-btn-hairline">Book Free Site Visit</span></div>
      <div class="mini-products-grid luxury-grid">
        <div class="mini-card-hairline"><span class="mini-card-img img-obsidian"></span><strong class="mini-card-name">50x100 Juja Farm</strong><span class="mini-card-price">KES 1,350,000</span></div>
        <div class="mini-card-hairline"><span class="mini-card-img img-brass"></span><strong class="mini-card-name">Kitengela 4BR Villa</strong><span class="mini-card-price">KES 14,500,000</span></div>
        <div class="mini-card-hairline"><span class="mini-card-img img-taupe"></span><strong class="mini-card-name">Ruiru Kamakis Plot</strong><span class="mini-card-price">KES 3,800,000</span></div>
      </div>`;
  }

  if (id === "food-and-groceries") {
    return `
      <div class="mini-canopy-stripe"></div>
      <div class="mini-browserbar mini-food-bar"><span class="mini-dots"><i class="dot-amber"></i><i class="dot-amber"></i><i class="dot-green"></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-food">Kitchen Live 🍲</span></div>
      <div class="mini-hero food-hero"><span class="mini-badge-warm">🔥 FRESH HARVEST &amp; SPECIALS</span><strong class="mini-title">Authentic Flavours &amp; Farm-Fresh Daily</strong><span class="mini-btn-warm">Order Fresh Food 🥘</span></div>
      <div class="mini-menu-list">
        <div class="mini-menu-row"><span>Swahili Beef Biryani</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 650</b></div>
        <div class="mini-menu-row"><span>Sizzling Mbuzi Choma (1/2kg)</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 950</b></div>
        <div class="mini-menu-row"><span>Farm Fresh Veggie Crate</span><i class="menu-divider-dots"></i><b class="menu-price-pill">KES 1,200</b></div>
      </div>`;
  }

  if (id === "hardware-and-autoparts") {
    return `
      <div class="mini-browserbar brutalist-bar"><span class="mini-dots"><i class="dot-black"></i><i class="dot-black"></i><i class="dot-red"></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill brutalist-tag">Trade Depot 🔩</span></div>
      <div class="mini-hero brutalist-hero"><span class="mini-badge-mono">KEBS STANDARD // IN STOCK</span><strong class="mini-title-heavy">BUILT TOUGH. CONTRACTOR GRADE SPARES.</strong><span class="mini-btn-brutal">Add to Order &rarr;</span></div>
      <div class="mini-products-grid brutalist-grid">
        <div class="mini-card-brutal"><span class="mini-card-img img-scarlet"></span><strong class="mini-card-name">Simba Cement 32.5R</strong><span class="mini-card-price">KES 780</span></div>
        <div class="mini-card-brutal"><span class="mini-card-img img-mono"></span><strong class="mini-card-name">200W Solar Kit</strong><span class="mini-card-price">KES 14,500</span></div>
        <div class="mini-card-brutal"><span class="mini-card-img img-ink"></span><strong class="mini-card-name">Hilux Service Kit</strong><span class="mini-card-price">KES 6,800</span></div>
      </div>`;
  }

  if (id === "furniture-and-decor") {
    return `
      <div class="mini-browserbar mini-maker-bar"><span class="mini-dots"><i class="dot-bronze"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-maker">Showroom 🛋️</span></div>
      <div class="mini-hero maker-hero"><span class="mini-badge-bronze">HANDCRAFTED HARDWOOD</span><strong class="mini-title-serif">Solid Timber &amp; Crafted Home Comfort</strong><span class="mini-btn-bronze">Explore Showroom</span></div>
      <div class="mini-products-grid maker-grid">
        <div class="mini-card-maker"><span class="mini-card-img img-leather"></span><strong class="mini-card-name">7-Seater Velvet Sofa</strong><span class="mini-card-price">KES 68,000</span></div>
        <div class="mini-card-maker"><span class="mini-card-img img-wood"></span><strong class="mini-card-name">Mahogany 6x6 King Bed</strong><span class="mini-card-price">KES 45,000</span></div>
        <div class="mini-card-maker"><span class="mini-card-img img-brass"></span><strong class="mini-card-name">Turkish Living Carpet</strong><span class="mini-card-price">KES 14,500</span></div>
      </div>`;
  }

  // Default: fashion-and-design
  return `
    <div class="mini-browserbar mini-editorial-bar"><span class="mini-dots"><i class="dot-oat"></i><i></i><i></i></span><span class="mini-domain">${subdomain}.store254.co.ke</span><span class="mini-status-pill pill-editorial">Boutique Atelier</span></div>
    <div class="mini-hero editorial-hero"><span class="mini-badge-editorial">NAIROBI BESPOKE COUTURE</span><strong class="mini-title-serif">Modern Heritage, Tailored in Nairobi.</strong><span class="mini-btn-editorial">Explore Lookbook</span></div>
    <div class="mini-products-grid editorial-grid">
      <div class="mini-card-editorial"><span class="mini-card-img img-oat"></span><strong class="mini-card-name">Ankara Midi Dress</strong><span class="mini-card-price">KES 4,200</span></div>
      <div class="mini-card-editorial"><span class="mini-card-img img-mocha"></span><strong class="mini-card-name">Maasai Sandals</strong><span class="mini-card-price">KES 2,400</span></div>
      <div class="mini-card-editorial"><span class="mini-card-img img-sage"></span><strong class="mini-card-name">Streetwear Bomber</strong><span class="mini-card-price">KES 3,800</span></div>
    </div>`;
}
