export function generatePreviewHtml(template) {
  const { id, name, mood, description, defaults, sampleFilters, sampleProducts, cardCta, trustBadges } = template;
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
  <title>${name} (${mood}) — Store254 Storefront Template Preview</title>
  ${template.googleFont ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${template.googleFont}" rel="stylesheet">` : ""}
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
    <div>
      <span class="preview-badge">Self-Contained Template</span>
    </div>
  </div>

  <header id="site-header">
    <div id="header-brand">
      <div id="header-store-identity">
        <h1 id="header-store-name">${name}</h1>
        <p id="header-store-tagline">${mood}</p>
        <span id="header-powered-by" class="header-powered-by">Powered by <strong>Store254</strong></span>
      </div>
    </div>
    <form id="search-form" onsubmit="event.preventDefault()">
      <label for="search-input" style="display:none">Search</label>
      <input type="search" id="search-input" placeholder="${template.searchPlaceholder || `Search ${name.toLowerCase()} catalog...`}">
    </form>
    <nav id="header-actions-nav">
      ${(template.headerActions || ["Profile", "Wishlist (2)", "Cart (3)"]).map((act, i, arr) =>
        i === arr.length - 1
          ? `<button type="button" id="desktop-cart-btn">${act}</button>`
          : `<button type="button">${act}</button>`
      ).join("\n      ")}
    </nav>
  </header>

  <nav id="storefront-category-nav">
    <div id="category-pills">
      <button type="button" aria-selected="true">${defaults.allUnitsLabel || "All Items"}</button>
      ${filterCategories.map(cat => `<button type="button" aria-selected="false">${cat}</button>`).join("\n      ")}
    </div>
  </nav>

  <section id="store-info-banner" class="store-banner">
    <div class="store-banner-inner">
      <div id="store-banner-content" class="store-banner-copy">
        <p id="banner-store-subdomain" class="store-address">${defaults.kicker}</p>
        <h2 id="banner-store-name">${titleText}</h2>
        <p id="banner-store-tagline" class="store-tagline"></p>
        <p id="banner-store-desc">${description}</p>
        ${trustBadges && trustBadges.length ? `
        <div class="store-trust-strip">
          ${trustBadges.map(b => `<span class="store-trust-badge">${b}</span>`).join("\n          ")}
        </div>` : ""}
        <div class="store-banner-actions">
          <a id="storefront-primary-cta" class="storefront-primary-cta" href="#items-grid">${defaults.cta}</a>
          ${defaults.secondaryCta ? `<a id="banner-store-call-btn" class="storefront-primary-cta" href="tel:+254700000000" style="background:var(--store-white) !important; color:var(--store-primary) !important; border:1px solid var(--store-line) !important;">${defaults.secondaryCta}</a>` : ""}
        </div>
      </div>
    </div>
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
        ${(sampleFilters?.extraGroups || []).map(group => `
        <fieldset>
          <legend>${group.title}</legend>
          ${group.items.map((item, idx) => `<label><input type="checkbox"${idx < 2 ? " checked" : ""}> ${item}</label>`).join("\n          ")}
        </fieldset>`).join("")}
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
              <button type="button" class="add-to-cart-btn">${p.cta || cardCta || "Add to Cart"}</button>
            </div>
          </article>
          `).join("")}
        </div>
      </section>
    </div>
  </main>

  <nav id="mobile-bottom-nav" class="mobile-bottom-nav">
    <button type="button">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
      <span>Home</span>
    </button>
    <button type="button">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
      <span>Portfolio</span>
    </button>
    <button type="button">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <span>Search</span>
    </button>
    <button type="button">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
      <span>Saved</span>
    </button>
    <button type="button">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      <span>Inquire</span>
    </button>
  </nav>

  <a href="#whatsapp" class="whatsapp-quick-contact" id="whatsapp-quick-contact" aria-label="WhatsApp Inquiry">
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.4rem;height:1.4rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
    <span>Inquire</span>
  </a>
</body>
</html>`;
}
