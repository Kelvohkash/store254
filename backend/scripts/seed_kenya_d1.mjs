import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const seedDir = join(backendRoot, "drizzle", "kenya_seed");

const targetFlag = process.argv.includes("--remote") ? "--remote" : "--local";
const files = readdirSync(seedDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No SQL seed files found in", seedDir);
  process.exit(1);
}

console.log(`Seeding ${files.length} Kenya geospatial SQL files (${targetFlag})...`);

for (const file of files) {
  const fullPath = join(seedDir, file);
  console.log(` -> Executing ${file}...`);
  const res = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "store254-db",
      targetFlag,
      "--config",
      join(backendRoot, "wrangler.toml"),
      "--file",
      fullPath,
    ],
    {
      cwd: backendRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    }
  );
  if (res.status !== 0) {
    console.error(`Failed while executing ${file} (exit code ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

console.log("Kenya geospatial dataset seed completed.");
