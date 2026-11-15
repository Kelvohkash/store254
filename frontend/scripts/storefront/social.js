// Storefront Social Links & Contact Channels

function getSocialLinkUrl(platform, value) {
  const input = String(value || "").trim();
  if (!input) return "";

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(input)) return "";

  if (platform === "whatsapp") {
    const phone = input.replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}` : "";
  }

  const handle = input.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  const profiles = {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    tiktok: "https://www.tiktok.com/@",
    twitter: "https://x.com/",
  };
  const baseUrl = profiles[platform];
  return baseUrl && handle ? `${baseUrl}${encodeURIComponent(handle)}` : "";
}

function renderStoreSocialLinks(socialLinks = {}) {
  const container = document.getElementById("banner-social-links");
  if (!container) return;
  const links = socialLinks || {};

  if (state.activeTenant?.settings?.sectionVisibility?.socialLinks === false) {
    container.classList.add("hidden");
    container.replaceChildren();
    return;
  }

  const platforms = [
    ["whatsapp", "WhatsApp", "message-circle"],
    ["instagram", "Instagram", "instagram"],
    ["tiktok", "TikTok", "music-2"],
    ["facebook", "Facebook", "facebook"],
    ["twitter", "X", "twitter"],
  ];

  container.replaceChildren();
  for (const [platform, label, iconName] of platforms) {
    const href = getSocialLinkUrl(platform, links[platform]);
    if (!href) continue;

    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.socialPlatform = platform;
    link.setAttribute("aria-label", `${label} — ${state.activeTenant?.name || "Store"}`);

    if (platform === "whatsapp") {
      const pulse = document.createElement("span");
      pulse.className = "social-live-dot";
      pulse.setAttribute("aria-hidden", "true");
      link.appendChild(pulse);
    }

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", iconName);
    icon.className = "w-3.5 h-3.5 shrink-0";
    icon.setAttribute("aria-hidden", "true");

    const textSpan = document.createElement("span");
    textSpan.textContent = label;

    const extIcon = document.createElement("i");
    extIcon.setAttribute("data-lucide", "arrow-up-right");
    extIcon.className = "w-3 h-3 opacity-60 shrink-0";
    extIcon.setAttribute("aria-hidden", "true");

    link.append(icon, textSpan, extIcon);
    container.appendChild(link);
  }

  container.classList.toggle("hidden", container.childElementCount === 0);
  if (typeof renderIcons === "function") {
    renderIcons(container);
  }
}

function renderStorefrontContact(settings) {
  const contact = document.getElementById("whatsapp-quick-contact");
  const value = settings.socialLinks?.whatsapp;
  const href = getSocialLinkUrl("whatsapp", value);
  if (!contact) return;

  if (!href || settings.sectionVisibility?.contactActions === false) {
    contact.classList.add("hidden");
    contact.removeAttribute("href");
    return;
  }

  const url = new URL(href);
  url.searchParams.set("text", `Hi ${state.activeTenant.name}, I found your store on Store254.`);
  contact.href = url.href;
  contact.classList.remove("hidden");
}
