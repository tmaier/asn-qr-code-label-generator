// Exact layout check: read the print layout of every label and QR code
// straight from the browser (layout units of 1/64 px ≈ 0.004 mm, before the
// pixel snapping that happens when painting) and compare it with the
// reference sheet. Catches geometry changes far below the print tests'
// tolerance, e.g. a 0.13 mm margin change.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { SHEET, QR_IN_LABEL, allLabelCells } from "./lib/avery-l4731rev-25.mjs";
import { resolveTarget, launch, openGenerator } from "./lib/print.mjs";

const LAYOUT_TOLERANCE_MM = 0.01;
const PX_TO_MM = 25.4 / 96;
const target = resolveTarget();

let browser;
before(async () => {
  browser = await launch();
});
after(async () => browser?.close());

test(`print layout matches ${SHEET.name} to ±${LAYOUT_TOLERANCE_MM} mm`, async () => {
  const page = await openGenerator(browser, {
    target,
    params: {},
    // A4 width in CSS px, so the page lays out like the printed page.
    pageOptions: { viewport: { width: Math.round(SHEET.pageWidth / PX_TO_MM), height: 1200 } },
  });
  let boxes;
  try {
    await page.emulateMedia({ media: "print" });
    boxes = await page.$$eval("ol li", (lis) =>
      lis.map((li) => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
        };
        return { label: box(li), qr: box(li.querySelector("img")) };
      }),
    );
  } finally {
    await page.close();
  }

  const cells = allLabelCells();
  assert.equal(boxes.length, cells.length, "number of labels");

  const problems = [];
  const check = (what, got, want) => {
    for (const k of ["x", "y", "w", "h"]) {
      const d = got[k] * PX_TO_MM - want[k];
      if (Math.abs(d) > LAYOUT_TOLERANCE_MM) {
        problems.push(
          `${what} ${k}: ${(got[k] * PX_TO_MM).toFixed(3)} mm, expected ${want[k].toFixed(3)} mm (${d > 0 ? "+" : ""}${d.toFixed(3)})`,
        );
      }
    }
  };
  for (const [i, cell] of cells.entries()) {
    const name = `label #${i + 1} (row ${cell.row + 1}, col ${cell.col + 1})`;
    check(name, boxes[i].label, cell);
    check(`${name} QR code`, boxes[i].qr, {
      x: cell.x + QR_IN_LABEL.x,
      y: cell.y + QR_IN_LABEL.y,
      w: QR_IN_LABEL.size,
      h: QR_IN_LABEL.size,
    });
  }
  assert.deepEqual(
    problems.slice(0, 20),
    [],
    `${problems.length} layout deviation(s) from ${SHEET.name}`,
  );
});
