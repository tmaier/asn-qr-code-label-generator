// The reference sheet used by the print tests must match Avery's own
// layout, as exported from Avery's label designer. See
// tests/fixtures/README.md for how to regenerate the export.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SHEET, allLabelCells, sheetSelfCheck } from "./lib/avery-l4731rev-25.mjs";
import { readAveryDesignerPdf } from "./lib/avery-designer-pdf.mjs";

// The export's page is 842 pt tall instead of 841.89 pt; allow for that.
const SOURCE_TOLERANCE_MM = 0.05;
const FIXTURE = new URL("./fixtures/avery-designer-l4731.pdf", import.meta.url);

test("reference sheet is self-consistent", () => {
  const { gapX, marginRight, marginBottom } = sheetSelfCheck();
  assert.ok(Math.abs(gapX - 2.54) < 1e-9, `horizontal gap ${gapX} mm`);
  assert.ok(Math.abs(marginRight - SHEET.marginLeft) < 0.05, `left ${SHEET.marginLeft} vs right ${marginRight} mm`);
  assert.ok(Math.abs(marginBottom - SHEET.marginTop) < 1e-9, `bottom margin ${marginBottom} mm`);
});

test("reference sheet matches Avery's label designer export", async () => {
  const avery = await readAveryDesignerPdf(fs.readFileSync(FIXTURE));
  const ours = allLabelCells();
  assert.equal(avery.cells.length, ours.length, "number of labels");

  const problems = [];
  for (const [i, want] of avery.cells.entries()) {
    const got = ours[i];
    for (const k of ["x", "y", "w", "h"]) {
      const d = got[k] - want[k];
      if (Math.abs(d) > SOURCE_TOLERANCE_MM) {
        problems.push(
          `label #${i + 1} ${k}: reference ${got[k].toFixed(3)} mm, Avery ${want[k].toFixed(3)} mm (${d > 0 ? "+" : ""}${d.toFixed(3)})`,
        );
      }
    }
  }
  assert.deepEqual(problems, [], problems.slice(0, 20).join("\n"));
});
