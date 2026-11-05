// Render the label sheet as printed (print media) at high resolution, cut
// out every label along its die-cut shape and decode its QR code with
// zxing-cpp, like Paperless-ngx would. Each label is decoded on its own.

import fs from "node:fs";
import { createRequire } from "node:module";
import { PNG } from "pngjs";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { openGenerator } from "./print.mjs";
import { SHEET, outsideRoundedCell } from "./avery-l4731rev-25.mjs";

// zxing-cpp, the decoder behind Paperless-ngx's ZXING barcode scanner.
// Load its WebAssembly from node_modules instead of the default CDN.
const require = createRequire(import.meta.url);
prepareZXingModule({
  overrides: { wasmBinary: fs.readFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm")) },
  fireImmediately: true,
});

const SCALE = 4; // device pixels per CSS pixel (~384 dpi)

// surround: grey level (0–255) of whatever is outside the label's die-cut
// shape — 255 for white paper, lower for a darker document.
export async function scanLabels(browser, { surround = 255, ...options }) {
  const page = await openGenerator(browser, {
    ...options,
    pageOptions: { viewport: { width: 800, height: 1200 }, deviceScaleFactor: SCALE },
  });
  try {
    await page.emulateMedia({ media: "print" });
    const sheet = page.locator("ol").first();
    const origin = await sheet.boundingBox();
    const labels = await page.$$eval("ol li", (lis) =>
      lis.map((li) => {
        const r = li.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    const png = PNG.sync.read(await sheet.screenshot({ scale: "device" }));

    return Promise.all(labels.map((l) => decode(png, {
      x: Math.round((l.x - origin.x) * SCALE),
      y: Math.round((l.y - origin.y) * SCALE),
      w: Math.round(l.w * SCALE),
      h: Math.round(l.h * SCALE),
    }, surround)));
  } finally {
    await page.close();
  }
}

// Copy one label (cut along its rounded die-cut shape) onto a canvas of the
// surround colour and decode it.
async function decode(png, box, surround) {
  const pad = Math.round(box.h / 2);
  const w = box.w + 2 * pad;
  const h = box.h + 2 * pad;
  const data = new Uint8ClampedArray(w * h * 4).fill(surround);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const r = (SHEET.cornerRadius / SHEET.labelHeight) * box.h;
  for (let y = 0; y < box.h; y++) {
    const sy = box.y + y;
    if (sy < 0 || sy >= png.height) continue;
    for (let x = 0; x < box.w; x++) {
      if (outsideRoundedCell({ x: 0, y: 0, w: box.w, h: box.h }, x + 0.5, y + 0.5, r) > 0) continue;
      const sx = box.x + x;
      if (sx < 0 || sx >= png.width) continue;
      const si = (sy * png.width + sx) * 4;
      const di = ((y + pad) * w + (x + pad)) * 4;
      data[di] = png.data[si];
      data[di + 1] = png.data[si + 1];
      data[di + 2] = png.data[si + 2];
    }
  }
  const results = await readBarcodes(
    { data, width: w, height: h, colorSpace: "srgb" },
    { formats: ["QRCode"], maxNumberOfSymbols: 1 },
  );
  return results[0]?.text ?? null;
}
