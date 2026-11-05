// Compare printed geometry against the Avery reference sheet.

import { SHEET, QR_IN_LABEL, allLabelCells, outsideRoundedCell } from "./avery-l4731rev-25.mjs";

const round = (v) => Math.round(v * 1000) / 1000;

function cellAt(cells, cx, cy) {
  return cells.find(
    (c) => cx >= c.x && cx < c.x + c.w && cy >= c.y && cy < c.y + c.h,
  );
}

function union(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const b = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: b - y };
}

// QR symbols printed on a page. SVG QR codes arrive as dark vector paths
// (the modules); their union per label is the symbol. Raster QR codes
// (older versions) arrive as images, whose box includes any quiet zone.
function qrSymbols(page, cells, problems) {
  const shapes = page.darkPaths.length ? page.darkPaths : page.images;
  const byCell = new Map();
  for (const s of shapes) {
    const cell = cellAt(cells, s.x + s.w / 2, s.y + s.h / 2);
    if (!cell) {
      problems.push(`QR code part at (${round(s.x)}, ${round(s.y)}) mm is not on any label`);
      continue;
    }
    if (!byCell.has(cell.index)) byCell.set(cell.index, []);
    byCell.get(cell.index).push(s);
  }
  const symbols = new Map();
  for (const [i, parts] of byCell) {
    // Raster images map one-to-one; vector parts are merged.
    symbols.set(i, page.darkPaths.length ? [union(parts)] : parts);
  }
  return symbols;
}

const corners = (b) => [
  [b.x, b.y],
  [b.x + b.w, b.y],
  [b.x, b.y + b.h],
  [b.x + b.w, b.y + b.h],
];

// How far box b sticks out of rectangle r on each side (positive = outside).
function overhang(b, r) {
  return {
    left: r.x - b.x,
    right: b.x + b.w - (r.x + r.w),
    top: r.y - b.y,
    bottom: b.y + b.h - (r.y + r.h),
  };
}

export function expectedText({ startNumber, prefix, leadingZeros }, index) {
  return prefix + String(startNumber + index).padStart(leadingZeros + 1, "0");
}

/**
 * @param pdf      result of readPdf()
 * @param options  { tolerance (mm), labels: { startNumber, prefix, leadingZeros } }
 * @returns        { problems: string[], labels: [...], summary: {...} }
 */
export function compareWithSheet(pdf, { tolerance, labels: labelParams }) {
  const problems = [];
  const cells = allLabelCells();
  const { pages } = pdf;

  if (pages.length !== 1) {
    problems.push(
      `expected exactly 1 page, the browser printed ${pages.length}`,
    );
  }
  const page = pages[0];
  const dw = page.width - SHEET.pageWidth;
  const dh = page.height - SHEET.pageHeight;
  if (Math.abs(dw) > tolerance || Math.abs(dh) > tolerance) {
    problems.push(
      `page is ${round(page.width)} × ${round(page.height)} mm, expected A4 ` +
        `${SHEET.pageWidth} × ${SHEET.pageHeight} mm (±${tolerance} mm)`,
    );
  }

  // QR codes printed on later pages are spilled labels.
  const spilled = pages
    .slice(1)
    .reduce((n, p) => n + p.images.length + p.darkPaths.length, 0);
  if (spilled > 0) {
    problems.push(`QR code(s) spilled onto page 2 or later (${spilled} shapes)`);
  }

  // Assign each printed QR code and text run to the reference cell that
  // contains its centre. Anything whose centre is not on a label is a
  // deviation on its own.
  const symbols = qrSymbols(page, cells, problems);
  if (symbols.size !== cells.length) {
    problems.push(`expected QR codes on all ${cells.length} labels, found them on ${symbols.size}`);
  }
  const byCell = new Map(
    cells.map((c) => [c.index, { qr: symbols.get(c.index) ?? [], text: [] }]),
  );
  for (const t of page.texts) {
    const cell = cellAt(cells, t.x + t.w / 2, t.y + t.h / 2);
    if (cell) byCell.get(cell.index).text.push(t);
    else if (/\d/.test(t.str))
      problems.push(
        `text "${t.str}" at (${round(t.x)}, ${round(t.y)}) mm is not on any label`,
      );
  }

  const labels = [];
  for (const cell of cells) {
    const { qr, text } = byCell.get(cell.index);
    const name = `label #${cell.index + 1} (row ${cell.row + 1}, col ${cell.col + 1})`;
    const entry = { cell, qr: qr[0] ?? null, text: null, deviation: null, failed: false };
    labels.push(entry);

    if (qr.length !== 1) {
      problems.push(`${name}: expected 1 QR code, found ${qr.length}`);
      entry.failed = true;
      continue;
    }

    // 1. QR code position against the reference grid.
    const want = {
      x: cell.x + QR_IN_LABEL.x,
      y: cell.y + QR_IN_LABEL.y,
      size: QR_IN_LABEL.size,
    };
    const dev = {
      dx: qr[0].x - want.x,
      dy: qr[0].y - want.y,
      dw: qr[0].w - want.size,
      dh: qr[0].h - want.size,
    };
    entry.deviation = dev;
    const worst = Math.max(...Object.values(dev).map(Math.abs));
    if (worst > tolerance) {
      entry.failed = true;
      problems.push(
        `${name}: QR code off by dx=${round(dev.dx)} dy=${round(dev.dy)} ` +
          `dw=${round(dev.dw)} dh=${round(dev.dh)} mm (±${tolerance} mm)`,
      );
    }

    // 2. Everything printed for this label must stay on the label.
    const runs = text.sort((a, b) => a.x - b.x);
    const str = runs.map((t) => t.str).join("");
    if (runs.length) {
      const x = Math.min(...runs.map((t) => t.x));
      const y = Math.min(...runs.map((t) => t.y));
      const r = Math.max(...runs.map((t) => t.x + t.w));
      const b = Math.max(...runs.map((t) => t.y + t.h));
      entry.text = { str, x, y, w: r - x, h: b - y };
    }
    for (const [kind, box] of [["QR code", qr[0]], ["text", entry.text]]) {
      if (!box) continue;
      const o = overhang(box, cell);
      const sides = Object.entries(o).filter(([, v]) => v > tolerance);
      if (sides.length) {
        entry.failed = true;
        problems.push(
          `${name}: ${kind} sticks out of the label by ` +
            sides.map(([s, v]) => `${round(v)} mm ${s}`).join(", "),
        );
      }
    }

    // 2b. Die-cut labels have rounded corners; the QR symbol's corners must
    // not fall outside them.
    {
      const out = Math.max(
        ...corners(qr[0]).map(([px, py]) => outsideRoundedCell(cell, px, py)),
      );
      entry.cornerOutside = out;
      if (out > tolerance) {
        entry.failed = true;
        problems.push(
          `${name}: QR code corner lies ${round(out)} mm outside the label's ${SHEET.cornerRadius} mm rounded corner`,
        );
      }
    }

    // 3. The right number on the right label.
    if (labelParams) {
      const want = expectedText(labelParams, cell.index);
      if (str !== want) {
        entry.failed = true;
        problems.push(`${name}: printed text "${str}", expected "${want}"`);
      }
    }
  }

  const devs = labels.filter((l) => l.deviation).map((l) => l.deviation);
  const maxAbs = (k) => round(Math.max(0, ...devs.map((d) => Math.abs(d[k]))));
  const summary = {
    pages: pages.length,
    page: { width: round(page.width), height: round(page.height) },
    qrCodes: symbols.size,
    maxCornerOutsideMm: round(Math.max(0, ...labels.map((l) => l.cornerOutside ?? 0))),
    maxDeviationMm: { x: maxAbs("dx"), y: maxAbs("dy"), size: Math.max(maxAbs("dw"), maxAbs("dh")) },
    failedLabels: labels.filter((l) => l.failed).length,
    tolerance,
  };

  return { problems, labels, summary };
}
