import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBinPath = path.join(rootDir, "node_modules", "wrangler", "bin", "wrangler.js");

// 1. Patch local wrangler bin entrypoint so Cloudflare Workers Builds running from
// the monorepo root automatically selects the right Worker config based on WRANGLER_CI_OVERRIDE_NAME.
if (fs.existsSync(wranglerBinPath)) {
  const original = fs.readFileSync(wranglerBinPath, "utf8");
  const marker = "// [store254-ci-config-router]";
  if (!original.includes(marker)) {
    const routerSnippet = `${marker}
if (
  process.argv.includes("deploy") &&
  !process.argv.some((arg) => arg === "--config" || arg === "-c" || arg.startsWith("--config="))
) {
  const targetWorker = process.env.WRANGLER_CI_OVERRIDE_NAME || "";
  if (targetWorker === "store254-backend") {
    process.argv.push("--config", "backend/wrangler.toml", "--minify");
  } else if (targetWorker === "store254-frontend") {
    process.argv.push("--config", "frontend/wrangler.jsonc");
  }
}
`;
    const updated = original.replace(
      "function runWrangler() {",
      `${routerSnippet}\nfunction runWrangler() {`
    );
    fs.writeFileSync(wranglerBinPath, updated, "utf8");
  }
}

// 2. When running inside CI (Cloudflare Workers Builds or GitHub Actions),
// ensure backend and frontend dependencies and compiled Tailwind styles are ready.
const isCI = Boolean(
  process.env.WORKERS_CI ||
  process.env.CI ||
  process.env.WRANGLER_CI_OVERRIDE_NAME
);

if (isCI) {
  const targetWorker = process.env.WRANGLER_CI_OVERRIDE_NAME || "";
  if (!targetWorker || targetWorker === "store254-backend") {
    console.log("[ci-setup] Installing backend dependencies...");
    try {
      execSync("npm --prefix backend ci", { cwd: rootDir, stdio: "inherit" });
    } catch (ciError) {
      console.warn("[ci-setup] 'npm ci' failed for backend; falling back to 'npm install'...", ciError.message);
      execSync("npm --prefix backend install --no-audit --prefer-offline", { cwd: rootDir, stdio: "inherit" });
    }
  }
  if (!targetWorker || targetWorker === "store254-frontend") {
    console.log("[ci-setup] Installing frontend dependencies and building styles...");
    try {
      execSync("npm --prefix frontend ci", { cwd: rootDir, stdio: "inherit" });
    } catch (ciError) {
      console.warn("[ci-setup] 'npm ci' failed for frontend; falling back to 'npm install'...", ciError.message);
      execSync("npm --prefix frontend install --no-audit --prefer-offline", { cwd: rootDir, stdio: "inherit" });
    }
    execSync("npm --prefix frontend run build", { cwd: rootDir, stdio: "inherit" });
  }
}
