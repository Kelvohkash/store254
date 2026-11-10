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
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["tiktok", "TikTok"],
    ["twitter", "X"],
    ["whatsapp", "WhatsApp"],
  ];

  container.replaceChildren();
  for (const [platform, label] of platforms) {
    const href = getSocialLinkUrl(platform, links[platform]);
    if (!href) continue;

    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    container.appendChild(link);
  }

  container.classList.toggle("hidden", container.childElementCount === 0);
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
