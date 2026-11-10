/**
 * Store254 Web Application Client Engine - Storefront Catalog Loader
 */

let storefrontTemplateCatalogPromise;
function loadStorefrontTemplateCatalog() {
  if (!storefrontTemplateCatalogPromise) {
    storefrontTemplateCatalogPromise = fetch("/templates/catalog.json")
      .then((response) => {
        if (!response.ok) throw new Error("Template catalog unavailable");
        return response.json();
      })
      .then((catalog) => Array.isArray(catalog.templates) ? catalog : { templates: [] })
      .catch((error) => {
        console.error("[Storefront] Could not load template catalog:", error);
        return { templates: [] };
      });
  }
  return storefrontTemplateCatalogPromise;
}

async function loadStorefrontTemplateStylesheet(template) {
  let link = document.getElementById("active-storefront-template-styles");
  const stylesheet = template?.stylesheet;
  if (!stylesheet || !/^[a-z0-9][a-z0-9/_-]*\.css$/i.test(stylesheet) || stylesheet.includes("..")) {
    link?.remove();
    return;
  }
  const href = new URL(`/templates/${stylesheet}`, window.location.origin).href;
  if (link?.href === href && link.dataset.loaded === "true") return;
  link?.remove();
  link = document.createElement("link");
  link.id = "active-storefront-template-styles";
  link.rel = "stylesheet";
  link.href = href;
  await new Promise((resolve) => {
    link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
    link.addEventListener("error", () => { console.error(`[Storefront] Template style could not be loaded: ${template.id}`); resolve(); }, { once: true });
    document.head.append(link);
  });
}
