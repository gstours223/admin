#!/usr/bin/env node
/**
 * Production build entry used by Hostinger (`npm run build`) and by Grok/Vercel.
 *
 * Hostinger clones the app under .../hbuilds/source/repository and runs
 * `npm run build`. A missing `scripts/with-app-env.mjs` must not fail the
 * deploy — this file lives at the repo root so Node can always find it.
 *
 * - Hostinger (hbuilds path, or HOSTINGER=1, or NITRO_PRESET=node-server):
 *   Nitro node-server output at .output/server/index.mjs
 * - Otherwise: Nitro vercel preset (Grok publish)
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };

const onHostinger =
  env.HOSTINGER === "1" ||
  env.NITRO_PRESET === "node-server" ||
  /[/\\]hbuilds[/\\]/.test(root) ||
  /[/\\]domains[/\\]/.test(root);

if (onHostinger) {
  env.NITRO_PRESET = env.NITRO_PRESET || "node-server";
  env.NODE_ENV = env.NODE_ENV || "production";
  if (!env.VITE_AUTH_ENABLED) env.VITE_AUTH_ENABLED = "true";
}

try {
  const appEnvPath = join(root, ".grok/app-env.json");
  if (existsSync(appEnvPath)) {
    const parsed = JSON.parse(readFileSync(appEnvPath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (!key.startsWith("VITE_")) continue;
        if (typeof value !== "string") continue;
        if (env[key] === undefined) env[key] = value;
      }
    }
  }
} catch {
  // Preview-only flags. Missing file is normal on Hostinger.
}

const required = [
  "package.json",
  "vite.config.ts",
  "src",
  "public",
  "migrations",
  "scripts/grok-pwa-plugin.mjs",
  "scripts/app-env-plugin.mjs",
  "scripts/migration-plan.mjs",
];
const missing = required.filter((rel) => !existsSync(join(root, rel)));
if (missing.length) {
  console.error(
    "[build] This upload is incomplete. Missing:\n  - " +
      missing.join("\n  - ") +
      "\nRe-upload the full gstours-hostinger.zip (do not delete folders).",
  );
  process.exit(1);
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: "inherit", env, cwd: root });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} ${args.join(" ")} failed (${signal || code})`));
    });
  });
}

const viteJs = join(root, "node_modules/vite/bin/vite.js");
if (!existsSync(viteJs)) {
  console.error("[build] vite is not installed. Hostinger must run npm install first.");
  process.exit(1);
}

console.log(
  `[build] NITRO_PRESET=${env.NITRO_PRESET || "vercel"} cwd=${root}`,
);

await run(process.execPath, [viteJs, "build"]);

const migrateJs = join(root, "scripts/migrate.mjs");
if (existsSync(migrateJs)) {
  await run(process.execPath, [migrateJs]);
} else {
  console.log("[build] scripts/migrate.mjs missing — skipping migrations");
}
