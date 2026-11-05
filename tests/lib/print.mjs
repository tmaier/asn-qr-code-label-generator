// Load the generator in Chromium and print it to PDF, the way Chrome's
// "Save as PDF" does: print media, CSS @page size and margins honoured.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import QRCode from "qrcode";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCAL_ORIGIN = "http://asn-label-generator.test";

// Offline stand-in for api.qrserver.com's `format=svg` output: a real QR
// code of the requested data, same structure (viewBox = symbol in modules,
// no quiet zone, one filled square per dark module, error correction L).
export function qrSvg(data) {
  const { modules } = QRCode.create(data, { errorCorrectionLevel: "L" });
  const n = modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.get(y, x)) d += `M${x},${y}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="300" height="300" viewBox="0 0 ${n} ${n}">` +
    `<rect fill="#ffffff" x="0" y="0" width="${n}" height="${n}"/>` +
    `<path fill="#000000" d="${d}"/></svg>`
  );
}

// Resolve what to test:
//   ASN_TARGET unset            -> ./index.html of this checkout
//   ASN_TARGET=path/to/file     -> that HTML file
//   ASN_TARGET=https://...      -> a deployed page, e.g. the live site
export function resolveTarget(target = process.env.ASN_TARGET) {
  if (target && /^https?:\/\//.test(target)) return { url: target };
  const file = path.resolve(ROOT, target || "index.html");
  return { url: `${LOCAL_ORIGIN}/`, html: fs.readFileSync(file, "utf8"), file };
}

export async function launch() {
  return chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
}

// Open the generator with the given URL parameters and wait until every
// QR code has loaded. The caller closes the page.
export async function openGenerator(browser, { target, params = {}, liveQr, pageOptions }) {
  const page = await browser.newPage(pageOptions);
  if (target.html) {
    await page.route(`${LOCAL_ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: target.html }),
    );
  }
  if (!liveQr) {
    // Answer like the real API: SVG only when the page asks for it.
    await page.route("https://api.qrserver.com/**", async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const data = params.get("data");
      if (params.get("format") === "svg") {
        await route.fulfill({ contentType: "image/svg+xml", body: qrSvg(data) });
      } else {
        const png = await QRCode.toBuffer(data, { errorCorrectionLevel: "L", margin: 1, width: 300 });
        await route.fulfill({ contentType: "image/png", body: png });
      }
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
