/** Load the one supported storefront theme. */
async function loadDefaultStorefrontStyles() {
  const id = "active-storefront-styles";
  let link = document.getElementById(id);
  const href = new URL("/styles/storefront-default.css", window.location.origin).href;
  if (link?.href === href && link.dataset.loaded === "true") return;
  link?.remove();
  link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  await new Promise((resolve) => {
    link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
    link.addEventListener("error", () => { console.error("[Storefront] Default storefront styles could not be loaded"); resolve(); }, { once: true });
    document.head.append(link);
  });
}
