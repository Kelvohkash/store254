import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const seedDir = join(backendRoot, "drizzle", "kenya_seed");

const targetFlag = process.argv.includes("--remote") ? "--remote" : "--local";
const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
const fromFile = fromArg ? fromArg.slice("--from=".length) : null;

let files = readdirSync(seedDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (fromFile) {
  const startIndex = files.indexOf(fromFile);
  if (startIndex === -1) {
    console.error(`Seed file specified by --from=${fromFile} was not found in ${seedDir}`);
    process.exit(1);
  }
  files = files.slice(startIndex);
}

if (files.length === 0) {
  console.error("No SQL seed files found in", seedDir);
  process.exit(1);
}

console.log(`Seeding ${files.length} Kenya geospatial SQL files (${targetFlag})...`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const file of files) {
  const fullPath = join(seedDir, file);
  let status = 1;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(` -> Executing ${file}${attempt > 1 ? ` (retry ${attempt - 1})` : ""}...`);
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
    status = res.status ?? 1;
    if (status === 0) {
      break;
    }
    if (attempt < 3) {
      console.warn(`Transient error on ${file} (exit ${status}); waiting 3s before retry...`);
      await sleep(3000);
    }
  }
  if (status !== 0) {
    console.error(`Failed while executing ${file} (exit code ${status})`);
    process.exit(status);
  }
}

console.log("Kenya geospatial dataset seed completed.");
