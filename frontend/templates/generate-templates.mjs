#!/usr/bin/env node
/**
 * Store254 Universal Storefront Template & Automatic Color Harmony Generator
 *
 * Generates self-contained storefront themes under `frontend/templates/<id>/`
 * (`template.css` + `preview.html`) and updates `frontend/templates/catalog.json`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PALETTES } from "./generator/palettes.mjs";
import { TEMPLATE_BLUEPRINTS } from "./generator/blueprints/index.mjs";
import { generateTemplateCss } from "./generator/css-stylesheet.mjs";
import { generatePreviewHtml } from "./generator/preview-builder.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export { PALETTES } from "./generator/palettes.mjs";
export { TEMPLATE_BLUEPRINTS } from "./generator/blueprints/index.mjs";
export { generateTemplateCss } from "./generator/css-stylesheet.mjs";
export { generatePreviewHtml } from "./generator/preview-builder.mjs";

export async function generateAllTemplates(templatesDir = __dirname) {
  const catalogEntries = [];

  for (const template of TEMPLATE_BLUEPRINTS) {
    const dir = join(templatesDir, template.id);
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

  await writeFile(join(templatesDir, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n", "utf8");
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
