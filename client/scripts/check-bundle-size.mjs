#!/usr/bin/env node
/**
 * Fails the build if the initial homepage payload grows beyond the budget.
 *
 * This guards the Phase 4 gains: the main `index-*.js` chunk (the only JS
 * that runs on first paint for logged-in users landing on /) must stay
 * comfortably under 150 KB gzipped. If you intentionally need more, raise
 * the budget with a justification in the commit message.
 *
 * Usage: `node scripts/check-bundle-size.mjs` from the client directory,
 * after `vite build` has produced dist/.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "..", "dist", "assets");

const BUDGET_GZIP_BYTES = 150 * 1024;
const BUDGET_RAW_BYTES = 500 * 1024;

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} kB`;
  return `${n} B`;
}

function findMainBundle() {
  let files;
  try {
    files = readdirSync(distDir);
  } catch (err) {
    console.error(`[check-bundle-size] dist/assets not found (${err.message}). Run 'vite build' first.`);
    process.exit(1);
  }
  const matches = files.filter((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name));
  if (matches.length === 0) {
    console.error("[check-bundle-size] No index-*.js file found in dist/assets/.");
    process.exit(1);
  }
  if (matches.length > 1) {
    console.warn(
      `[check-bundle-size] Found multiple index-*.js files; using the largest: ${matches.join(", ")}`,
    );
  }
  const picked = matches
    .map((name) => ({ name, size: statSync(join(distDir, name)).size }))
    .sort((a, b) => b.size - a.size)[0];
  return picked.name;
}

const mainFile = findMainBundle();
const fullPath = join(distDir, mainFile);
const raw = readFileSync(fullPath);
const gzipped = gzipSync(raw);

console.log(
  `[check-bundle-size] ${mainFile}: raw=${formatBytes(raw.length)}, gzip=${formatBytes(gzipped.length)}`,
);
console.log(
  `[check-bundle-size] budget: raw<${formatBytes(BUDGET_RAW_BYTES)}, gzip<${formatBytes(BUDGET_GZIP_BYTES)}`,
);

let failed = false;
if (gzipped.length > BUDGET_GZIP_BYTES) {
  console.error(
    `[check-bundle-size] FAIL gzip: ${formatBytes(gzipped.length)} > ${formatBytes(BUDGET_GZIP_BYTES)}`,
  );
  failed = true;
}
if (raw.length > BUDGET_RAW_BYTES) {
  console.error(
    `[check-bundle-size] FAIL raw: ${formatBytes(raw.length)} > ${formatBytes(BUDGET_RAW_BYTES)}`,
  );
  failed = true;
}

if (failed) {
  console.error(
    "[check-bundle-size] Main bundle exceeded the initial-paint budget. " +
      "Either split more routes/components with React.lazy() or update the budget " +
      "in client/scripts/check-bundle-size.mjs with a justification.",
  );
  process.exit(1);
}

console.log("[check-bundle-size] OK");
