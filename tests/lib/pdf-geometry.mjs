// Extract what actually got printed from a PDF: page sizes, where every
// raster image and dark vector shape was painted, and where every text run
// sits. All output is in millimetres with the origin at the top-left corner
// of the page.

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

// Bounding box of the unit square [0,1]² under matrix m (PDF image space).
function unitSquareBox(m, pageHeightPt) {
  const xs = [m[4], m[4] + m[0], m[4] + m[2], m[4] + m[0] + m[2]];
  const ys = [m[5], m[5] + m[1], m[5] + m[3], m[5] + m[1] + m[3]];
  const left = Math.min(...xs);
  const top = pageHeightPt - Math.max(...ys);
  return {
    x: left * PT_TO_MM,
    y: top * PT_TO_MM,
    w: (Math.max(...xs) - left) * PT_TO_MM,
    h: (Math.max(...ys) - Math.min(...ys)) * PT_TO_MM,
  };
}

const IMAGE_OPS = new Set([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
]);

const FILL_OPS = new Set([
  pdfjs.OPS.fill,
  pdfjs.OPS.eoFill,
  pdfjs.OPS.fillStroke,
  pdfjs.OPS.eoFillStroke,
]);

function isDark(hex) {
  const v = parseInt(String(hex).slice(1), 16);
  return [16, 8, 0].every((shift) => ((v >> shift) & 0xff) < 64);
}

// Bounding box [minX, minY, maxX, maxY] (path space) under matrix m.
function boxUnder(m, [minX, minY, maxX, maxY], pageHeightPt) {
  const pts = [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    x: Math.min(...xs) * PT_TO_MM,
    y: (pageHeightPt - Math.max(...ys)) * PT_TO_MM,
    w: (Math.max(...xs) - Math.min(...xs)) * PT_TO_MM,
    h: (Math.max(...ys) - Math.min(...ys)) * PT_TO_MM,
  };
}

async function extractPage(page) {
  const [x0, y0, x1, y1] = page.view;
  const heightPt = y1 - y0;

  // Raster images (QR codes from older versions, as PNG) and dark filled
  // vector paths (QR codes as SVG: the black modules).
  const images = [];
  const darkPaths = [];
  const ops = await page.getOperatorList();
  let state = { ctm: [1, 0, 0, 1, 0, 0], fill: "#000000" }; // PDF default fill: black
  const stack = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === pdfjs.OPS.save) stack.push({ ...state });
    else if (fn === pdfjs.OPS.restore) state = stack.pop() ?? state;
    else if (fn === pdfjs.OPS.transform) state.ctm = multiply(state.ctm, args);
    else if (fn === pdfjs.OPS.setFillRGBColor) state.fill = args[0];
    else if (IMAGE_OPS.has(fn)) images.push(unitSquareBox(state.ctm, heightPt));
    else if (fn === pdfjs.OPS.constructPath && FILL_OPS.has(args[0]) && isDark(state.fill)) {
      darkPaths.push(boxUnder(state.ctm, args[2], heightPt));
    }
  }

  // Text runs. pdf.js gives the baseline origin, advance width and font
  // size; the glyph box is approximated as 0.8 em above and 0.2 em below
  // the baseline, which covers Latin capitals and digits.
  const texts = [];
  const content = await page.getTextContent();
  for (const item of content.items) {
    if (!item.str || !item.str.trim()) continue;
    const size = Math.hypot(item.transform[2], item.transform[3]);
    const baseline = heightPt - item.transform[5];
    texts.push({
      str: item.str.trim(),
      x: item.transform[4] * PT_TO_MM,
      y: (baseline - 0.8 * size) * PT_TO_MM,
      w: item.width * PT_TO_MM,
      h: size * PT_TO_MM,
    });
  }

  return {
    width: (x1 - x0) * PT_TO_MM,
    height: heightPt * PT_TO_MM,
    images,
    darkPaths,
    texts,
  };
}

export async function readPdf(bytes) {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    pages.push(await extractPage(await doc.getPage(n)));
  }
  await task.destroy();
  return { pages };
}
