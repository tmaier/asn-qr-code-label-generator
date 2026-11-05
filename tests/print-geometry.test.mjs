// Integration test: print the generator to PDF in Chromium and compare the
// printed labels with the Avery L4731REV-25 reference sheet.
//
//   mise run test
//   ASN_TOLERANCE_MM=0.5 mise run test                  # looser (default 0.3)
//   mise run test:live                                  # live site, real QR API
//
// Printed PDFs, overlays with the reference sheet and JSON reports are
// written to test-results/<case>/.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SHEET } from "./lib/avery-l4731rev-25.mjs";
import { resolveTarget, launch, printToPdf } from "./lib/print.mjs";
import { readPdf } from "./lib/pdf-geometry.mjs";
import { overlayReference } from "./lib/overlay.mjs";
import { scanLabels } from "./lib/scan.mjs";
import { compareWithSheet, expectedText } from "./lib/compare.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "test-results");

// Allowed deviation per label edge. Chromium snaps printed content to whole
// CSS pixels (0.265 mm), which causes up to about ±0.13 mm per edge and
// 0.22 mm at the corner arcs; 0.3 mm leaves a little headroom above that.
const TOLERANCE = Number(process.env.ASN_TOLERANCE_MM || 0.3);
const LIVE_QR = process.env.ASN_LIVE_QR === "1";
const target = resolveTarget();

// The generator's defaults, used when the URL has no parameters.
const APP_DEFAULTS = { startNumber: 1, prefix: "ASN", leadingZeros: 3, borderToggle: false };

const CASES = [
  {
    // No URL parameters: checks the defaults the page starts with.
    name: "default",
    params: {},
    labels: APP_DEFAULTS,
  },
  {
    name: "with-border",
    params: { ...APP_DEFAULTS, borderToggle: true },
  },
  {
    // Crosses 9999999 -> 10000000: the text grows by a digit mid-sheet.
    name: "digit-rollover",
    params: { startNumber: 9_999_990, prefix: "ASN", leadingZeros: 7, borderToggle: false },
  },
  {
    // 13 characters: the text must shrink to stay on the label.
    name: "long-text",
    params: { startNumber: 1, prefix: "ASN", leadingZeros: 9, borderToggle: false },
  },
  {
    // Lower case forces the QR code into byte mode (more modules).
    name: "custom-prefix",
    params: { ...APP_DEFAULTS, prefix: "Archiv-" },
  },
];
let browser;
before(async () => {
  browser = await launch();
  console.log(
    `# target: ${target.file ?? target.url}\n` +
      `# reference: ${SHEET.name}, tolerance ±${TOLERANCE} mm, ` +
      `QR codes: ${LIVE_QR ? "live api.qrserver.com" : "generated offline"}`,
  );
});
after(async () => browser?.close());

for (const c of CASES) {
  test(`printed labels match ${SHEET.name} (${c.name})`, async () => {
    const pdfBytes = await printToPdf(browser, {
      target,
      params: c.params,
      liveQr: LIVE_QR,
    });
    const result = compareWithSheet(await readPdf(pdfBytes), {
      tolerance: TOLERANCE,
      labels: c.labels ?? c.params,
    });

    const dir = path.join(OUT, c.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "printed.pdf"), pdfBytes);
    fs.writeFileSync(
      path.join(dir, "overlay.pdf"),
      await overlayReference(pdfBytes, result, c.name),
    );
    fs.writeFileSync(
      path.join(dir, "report.json"),
      JSON.stringify(
        {
          target: target.file ? path.relative(ROOT, target.file) : target.url,
          case: c,
          summary: result.summary,
          problems: result.problems,
          labels: result.labels,
        },
        null,
        2,
      ) + "\n",
    );

    const s = result.summary;
    console.log(
      `# ${c.name}: page ${s.page.width}×${s.page.height} mm, ${s.pages} page(s), ` +
        `${s.qrCodes} QR codes, max deviation x ${s.maxDeviationMm.x} / ` +
        `y ${s.maxDeviationMm.y} / size ${s.maxDeviationMm.size} mm, ` +
        `QR corner outside rounded label corner max ${s.maxCornerOutsideMm} mm`,
    );

    const shown = result.problems.slice(0, 25);
    const more = result.problems.length - shown.length;
    assert.deepEqual(
      result.problems,
      [],
      `${result.problems.length} deviation(s) from ${SHEET.name}:\n  ` +
        shown.join("\n  ") +
        (more > 0 ? `\n  … and ${more} more (see ${path.relative(ROOT, dir)}/report.json)` : ""),
    );
  });
}

for (const c of CASES.filter((c) => !c.params.borderToggle)) {
  test(`every QR code scans as its label text (${c.name})`, async () => {
    const decoded = await scanLabels(browser, { target, params: c.params, liveQr: LIVE_QR });
    const wrong = decoded
      .map((got, i) => ({ i, got, want: expectedText(c.labels ?? c.params, i) }))
      .filter(({ got, want }) => got !== want);
    assert.deepEqual(
      wrong.slice(0, 10).map(({ i, got, want }) => `label #${i + 1}: scanned ${JSON.stringify(got)}, expected "${want}"`),
      [],
      `${wrong.length} of ${decoded.length} QR codes did not scan correctly`,
    );
  });
}

// Negative control: the comparison must catch a geometry error well below
// what anyone would notice on screen. Only meaningful for a local file.
test(
  "detects a 1 mm left-margin error (negative control)",
  { skip: !target.html && "ASN_TARGET is a URL" },
  async () => {
    const marker = "--sheet-margin-left: 8.467mm";
    assert.ok(target.html.includes(marker), `index.html no longer contains "${marker}"; update this test`);
    const broken = { ...target, html: target.html.replace(marker, "--sheet-margin-left: 9.467mm") };
    const params = APP_DEFAULTS;
    const result = compareWithSheet(
      await readPdf(await printToPdf(browser, { target: broken, params, liveQr: false })),
      { tolerance: TOLERANCE, labels: params },
    );
    assert.ok(
      result.summary.failedLabels > 0,
      `a 1 mm margin error went unnoticed: ${JSON.stringify(result.summary)}`,
    );
  },
);
