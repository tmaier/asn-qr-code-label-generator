// Build the standalone page into dist/:
//   index.html  the page
//   app.js      Alpine and src/standalone.js, bundled by esbuild
//   app.css     Tailwind for the page, built from src/standalone.css
//   asn.css     src/asn.css, copied unchanged (the tests print with it)
//
//   npm run build   (or: mise run build)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const at = (p) => path.join(ROOT, p);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
fs.copyFileSync(at("index.html"), path.join(DIST, "index.html"));
fs.copyFileSync(at("src/asn.css"), path.join(DIST, "asn.css"));

await esbuild.build({
  entryPoints: [at("src/standalone.js")],
  outfile: path.join(DIST, "app.js"),
  bundle: true,
  format: "iife", // a classic script, so dist/index.html also works from file://
  minify: true,
  target: "es2020",
  logLevel: "warning",
});

execFileSync(
  at("node_modules/.bin/tailwindcss"),
  ["--input", at("src/standalone.css"), "--output", path.join(DIST, "app.css"), "--minify"],
  { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] },
);

// Keep Tailwind's license banner but without its homepage URL, so dist/
// mentions no third-party host and a grep for CDNs stays clean.
const appCss = path.join(DIST, "app.css");
fs.writeFileSync(
  appCss,
  fs.readFileSync(appCss, "utf8").replace(/^(\/\*! tailwindcss v[^*]*MIT License) \| https:\/\/tailwindcss\.com \*\//, "$1 */"),
);

for (const f of fs.readdirSync(DIST)) {
  console.log(`dist/${f}  ${(fs.statSync(path.join(DIST, f)).size / 1024).toFixed(1)} kB`);
}
