// Draw the Avery reference sheet on top of the printed PDF, so a human can
// eyeball the result: green = reference die-cut outline, blue dashed =
// expected QR symbol position, red = a label with a deviation.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { SHEET, QR_IN_LABEL } from "./avery-l4731rev-25.mjs";

const MM_TO_PT = 72 / 25.4;

export async function overlayReference(pdfBytes, result, title) {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(0);
  const H = page.getHeight();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // pdf-lib uses PDF coordinates (pt, origin bottom-left).
  const rect = (box, opts) =>
    page.drawRectangle({
      x: box.x * MM_TO_PT,
      y: H - (box.y + box.h) * MM_TO_PT,
      width: box.w * MM_TO_PT,
      height: box.h * MM_TO_PT,
      borderWidth: 0.3,
      ...opts,
    });

  // Die-cut outline: rectangle with rounded corners, as an SVG path in pt
  // (drawSvgPath uses a top-left origin with y pointing down).
  const r = SHEET.cornerRadius * MM_TO_PT;
  const k = r * 0.5523; // Bézier approximation of a quarter circle
  const dieCut = (c, opts) => {
    const [x, y, w, h] = [c.x, c.y, c.w, c.h].map((v) => v * MM_TO_PT);
    const d =
      `M ${x + r} ${y} H ${x + w - r} C ${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r} ` +
      `V ${y + h - r} C ${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h} ` +
      `H ${x + r} C ${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r} ` +
      `V ${y + r} C ${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} Z`;
    page.drawSvgPath(d, { x: 0, y: H, ...opts });
  };

  for (const { cell, failed } of result.labels) {
    dieCut(cell, {
      borderColor: failed ? rgb(0.9, 0, 0) : rgb(0, 0.6, 0.2),
      borderWidth: failed ? 1 : 0.3,
    });
    rect(
      {
        x: cell.x + QR_IN_LABEL.x,
        y: cell.y + QR_IN_LABEL.y,
        w: QR_IN_LABEL.size,
        h: QR_IN_LABEL.size,
      },
      { borderColor: rgb(0.1, 0.3, 0.9), borderDashArray: [1, 1] },
    );
  }

  const s = result.summary;
  const lines = [
    `${title} vs. ${SHEET.name} reference — tolerance ±${s.tolerance} mm`,
    `page ${s.page.width} × ${s.page.height} mm, ${s.pages} page(s), ${s.qrCodes} QR codes, ` +
      `max deviation x ${s.maxDeviationMm.x} / y ${s.maxDeviationMm.y} / size ${s.maxDeviationMm.size} mm, ` +
      `${s.failedLabels} label(s) failed`,
  ];
  lines.forEach((text, i) =>
    page.drawText(text, {
      x: 8 * MM_TO_PT,
      y: H - (4 + i * 3.5) * MM_TO_PT,
      size: 7,
      font,
      color: s.failedLabels || result.problems.length ? rgb(0.9, 0, 0) : rgb(0, 0.5, 0.2),
    }),
  );

  return doc.save();
}
