// Load the generator in Chromium and print it to PDF, the way Chrome's
// "Save as PDF" does: print media, CSS @page size and margins honoured.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCAL_ORIGIN = "http://asn-label-generator.test";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

// Resolve what to test:
//   ASN_TARGET unset            -> dist/index.html of this checkout (mise run build)
//   ASN_TARGET=path/to/file     -> that HTML file, with the files next to it
//   ASN_TARGET=https://...      -> a deployed page, e.g. the live site
//
// A local target is served from its directory. `files` maps a path such as
// "/asn.css" to content served instead of the file on disk.
export function resolveTarget(target = process.env.ASN_TARGET) {
  if (target && /^https?:\/\//.test(target)) return { url: target };
  const file = path.resolve(ROOT, target || "dist/index.html");
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(ROOT, file)} not found; run \`mise run build\` first`);
  }
  return { url: `${LOCAL_ORIGIN}/`, html: fs.readFileSync(file, "utf8"), file, files: {} };
}

export async function launch() {
  return chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
}

// Open the generator with the given URL parameters and wait until every
// QR code has loaded. The caller closes the page. Each page gets a fresh
// browser context, so nothing is left in localStorage from an earlier one.
export async function openGenerator(browser, { target, params = {}, pageOptions }) {
  const page = await browser.newPage(pageOptions);
  if (target.html) {
    const dir = path.dirname(target.file);
    await page.route(`${LOCAL_ORIGIN}/**`, (route) => {
      let name = new URL(route.request().url()).pathname;
      if (name === "/") name = "/index.html";
      const file = path.join(dir, name);
      const body =
        name === "/index.html"
          ? target.html
          : (target.files?.[name] ?? (fs.existsSync(file) ? fs.readFileSync(file) : null));
      if (body == null) return route.fulfill({ status: 404 });
      return route.fulfill({ contentType: TYPES[path.extname(name)] ?? "application/octet-stream", body });
    });
  }

  const url = new URL(target.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  await page.goto(url.href, { waitUntil: "networkidle" });

  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll("ol li img")];
      return (
        imgs.length > 0 &&
        imgs.every((img) => img.complete && img.naturalWidth > 0)
      );
    },
    null,
    { timeout: 120_000 },
  );
  return page;
}

export async function printToPdf(browser, options) {
  const page = await openGenerator(browser, options);
  try {
    // preferCSSPageSize: use the page's own `@page { size: A4; margin: 0 }`
    // instead of overriding it, like the browser print dialog does.
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close();
  }
}
