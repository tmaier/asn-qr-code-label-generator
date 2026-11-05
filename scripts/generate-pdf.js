// Print the default label sheet of the built page (dist/) to asn-labels.pdf.
//
//   mise run pdf   (builds dist/ first)

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html not found; run `mise run build` first");
  process.exit(1);
}

// Serve dist/ over HTTP, as a static file server would.
const server = http.createServer((req, res) => {
  let name = new URL(req.url, "http://localhost").pathname;
  if (name === "/") name = "/index.html";
  const file = path.join(DIST, path.normalize(name));
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });

  console.log("Waiting for the labels and their QR codes...");
  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll("ol li img")];
      return images.length === 189 && images.every((img) => img.complete && img.naturalWidth > 0);
    },
    null,
    { timeout: 60_000 },
  );

  // Like the browser print dialog: the page's own @page size and margins.
  await page.pdf({ path: "asn-labels.pdf", preferCSSPageSize: true, printBackground: true });
  console.log("PDF generated: asn-labels.pdf");
} catch (err) {
  console.error("Error generating PDF:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
