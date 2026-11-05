// Read the label outlines from a PDF exported by Avery's label designer
// (app.avery.co.uk). Fill every label with a background colour before
// exporting: the designer then draws each label as a clip path in the exact
// shape of the label, which is what we read here. Output in mm, top-left
// origin, row-major order.

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PT_TO_MM = 25.4 / 72;

function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export async function readAveryDesignerPdf(bytes) {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const heightPt = page.view[3] - page.view[1];
  const ops = await page.getOperatorList();

  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const cells = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === pdfjs.OPS.save) stack.push(ctm);
    else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === pdfjs.OPS.transform) ctm = multiply(ctm, args);
    else if (fn === pdfjs.OPS.constructPath) {
      // args[2] is the path's bounding box [minX, minY, maxX, maxY] in the
      // current (translate-only) coordinate system.
      const [minX, minY, maxX, maxY] = args[2];
      cells.push({
        x: (ctm[4] + minX * ctm[0]) * PT_TO_MM,
        y: (heightPt - (ctm[5] + maxY * ctm[3])) * PT_TO_MM,
        w: (maxX - minX) * ctm[0] * PT_TO_MM,
        h: (maxY - minY) * ctm[3] * PT_TO_MM,
      });
    }
  }
  await task.destroy();

  cells.sort((a, b) => Math.round(a.y - b.y) || a.x - b.x);
  return {
    page: {
      width: (page.view[2] - page.view[0]) * PT_TO_MM,
      height: heightPt * PT_TO_MM,
    },
    cells,
  };
}
