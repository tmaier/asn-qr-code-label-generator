// Reference sheet for Avery L4731REV-25 (A4, 189 labels, 25.4 mm × 10 mm).
// All values in millimetres, origin at the top-left corner of the page.
// Keep in sync with the specification table in CLAUDE.md.
//
// Source: Avery's own label designer (app.avery.co.uk, template L4731),
// exported as tests/fixtures/avery-designer-l4731.pdf. Avery lays this sheet
// out on an inch grid: 1 in wide labels, 1.1 in pitch, 1/3 in left margin.
// The export's page is 596 × 842 pt (0.26 × 0.04 mm larger than A4), so the
// top margin is taken as the symmetric 13.5 mm rather than the exported
// 13.53 mm. tests/avery-reference.test.mjs checks these values against the
// export.

export const SHEET = Object.freeze({
  name: "Avery L4731REV-25",
  pageWidth: 210,
  pageHeight: 297,
  columns: 7,
  rows: 27,
  labelWidth: 25.4,
  labelHeight: 10,
  marginTop: 13.5,
  marginLeft: 25.4 / 3, // 8.467 mm
  pitchX: 27.94, // label width + 2.54 mm horizontal gap
  pitchY: 10, // labels touch vertically
  cornerRadius: 2, // die-cut labels have rounded corners
});

// Where the generator places the QR symbol (the modules, without quiet
// zone) inside a label: its corners sit exactly on the label's corner arcs,
// i.e. inset r·(1 − 1/√2) from the edges, and it spans the label height
// minus that inset on both sides. Mirrors --qr-inset / --qr-size in
// index.html.
const QR_INSET = SHEET.cornerRadius * (1 - Math.SQRT1_2);
export const QR_IN_LABEL = Object.freeze({
  x: QR_INSET,
  y: QR_INSET,
  size: SHEET.labelHeight - 2 * QR_INSET,
});

export function labelCount(sheet = SHEET) {
  return sheet.columns * sheet.rows;
}

// Reference rectangle of the n-th label (row-major, 0-based).
export function labelCell(index, sheet = SHEET) {
  const col = index % sheet.columns;
  const row = Math.floor(index / sheet.columns);
  const x = sheet.marginLeft + col * sheet.pitchX;
  const y = sheet.marginTop + row * sheet.pitchY;
  return { index, col, row, x, y, w: sheet.labelWidth, h: sheet.labelHeight };
}

export function allLabelCells(sheet = SHEET) {
  return Array.from({ length: labelCount(sheet) }, (_, i) =>
    labelCell(i, sheet),
  );
}

// How far point (px, py) lies outside the label's rounded rectangle (mm,
// positive = outside, 0 = on or inside).
export function outsideRoundedCell(cell, px, py, r = SHEET.cornerRadius) {
  const cx = Math.min(Math.max(px, cell.x + r), cell.x + cell.w - r);
  const cy = Math.min(Math.max(py, cell.y + r), cell.y + cell.h - r);
  return Math.max(0, Math.hypot(px - cx, py - cy) - r);
}

// Sanity check of the reference itself: the grid must fill the page.
export function sheetSelfCheck(sheet = SHEET) {
  const gapX = sheet.pitchX - sheet.labelWidth;
  const right =
    sheet.pageWidth -
    (sheet.marginLeft +
      (sheet.columns - 1) * sheet.pitchX +
      sheet.labelWidth);
  const bottom =
    sheet.pageHeight -
    (sheet.marginTop + (sheet.rows - 1) * sheet.pitchY + sheet.labelHeight);
  return { gapX, marginRight: right, marginBottom: bottom };
}
