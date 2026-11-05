// Unit tests for src/labels.js: label texts, the sheet, the QR symbol and
// the query string. No browser needed.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import {
  PER_SHEET,
  displayText,
  fromQuery,
  labelText,
  nextSheetStart,
  parseCount,
  qrSvg,
  sheet,
  toQuery,
} from "../src/labels.js";

// Load zxing-cpp's WebAssembly from node_modules instead of the default CDN.
const require = createRequire(import.meta.url);
prepareZXingModule({
  overrides: { wasmBinary: fs.readFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm")) },
  fireImmediately: true,
});

test("labelText pads the number to leadingZeros + 1 digits", () => {
  assert.equal(labelText(7, "ASN", 3), "ASN0007");
  assert.equal(labelText(12345, "ASN", 3), "ASN12345");
  assert.equal(labelText(1, "", 0), "1");
});

test("parseCount takes whole numbers from min up and rejects the rest", () => {
  assert.equal(parseCount("190", 1), 190);
  assert.equal(parseCount(" 0 ", 0), 0);
  assert.ok(isNaN(parseCount("0", 1)));
  assert.ok(isNaN(parseCount("1.5", 1)));
  assert.ok(isNaN(parseCount("-3", 0)));
  assert.ok(isNaN(parseCount("", 0)));
  assert.ok(isNaN(parseCount(null, 0)));
});

test("a sheet is 7 × 27 labels, numbered row by row", () => {
  const labels = sheet(190, "ASN", 3);
  assert.equal(labels.length, PER_SHEET);
  assert.equal(PER_SHEET, 189);
  assert.deepEqual(labels[0], { code: "ASN0190", text: "ASN0190", col: 0, row: 0 });
  assert.deepEqual(labels[7], { code: "ASN0197", text: "ASN0197", col: 0, row: 1 });
  assert.deepEqual(labels.at(-1), { code: "ASN0378", text: "ASN0378", col: 6, row: 26 });
});

test("displayText leaves out the prefix only with hidePrefix", () => {
  assert.equal(displayText(7, "ASN", 3), "ASN0007");
  assert.equal(displayText(7, "ASN", 3, false), "ASN0007");
  assert.equal(displayText(7, "ASN", 3, true), "0007");
  assert.equal(displayText(12345, "INV-", 0, true), "12345");
});

test("with hidePrefix the sheet prints the number, the code keeps the prefix", () => {
  const labels = sheet(190, "ASN", 3, { hidePrefix: true });
  assert.deepEqual(labels[0], { code: "ASN0190", text: "0190", col: 0, row: 0 });
  assert.deepEqual(labels.at(-1), { code: "ASN0378", text: "0378", col: 6, row: 26 });
  assert.deepEqual(sheet(1, "ASN", 3, { hidePrefix: false }), sheet(1, "ASN", 3));
});

test("the next sheet starts one full sheet later", () => {
  assert.equal(nextSheetStart(1), 190);
  assert.equal(nextSheetStart(190), 379);
  assert.equal(nextSheetStart(1), 1 + PER_SHEET);
});

test("the QR symbol has no quiet zone", () => {
  const svg = qrSvg("ASN0001");
  const size = Number(svg.match(/viewBox="0 0 (\d+) \1"/)?.[1]);
  assert.equal(size, 21, "a short ASN fits in a version 1 symbol");
  // The finder pattern starts in the very first module.
  assert.match(svg, /<path d="M0 0h7v1h-7z/);
});

// Decodes the QR symbol of `text` with zxing-cpp.
async function decodeQr(text) {
  // Draw the symbol with a quiet zone of four modules, as on a label.
  const svg = qrSvg(text);
  const size = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  const scale = 4;
  const side = (size + 8) * scale;
  const dark = new Set();
  for (const [, x, y, w] of svg.matchAll(/M(\d+) (\d+)h(\d+)/g))
    for (let i = 0; i < Number(w); i++)
      dark.add(`${Number(x) + i},${Number(y)}`);
  const pixels = new Uint8ClampedArray(side * side * 4);
  for (let py = 0; py < side; py++)
    for (let px = 0; px < side; px++) {
      const mx = Math.floor(px / scale) - 4;
      const my = Math.floor(py / scale) - 4;
      const v = dark.has(`${mx},${my}`) ? 0 : 255;
      pixels.set([v, v, v, 255], (py * side + px) * 4);
    }
  const [code] = await readBarcodes(
    { data: pixels, width: side, height: side, colorSpace: "srgb" },
    { formats: ["QRCode"] },
  );
  return code?.text;
}

test("the QR code decodes to the label text", async () => {
  for (const text of ["ASN0001", "ASN12345", "INV-2026-0042"])
    assert.equal(await decodeQr(text), text);
});

test("with hidePrefix the QR code still decodes to prefix and number", async () => {
  const [label] = sheet(42, "ASN", 3, { hidePrefix: true });
  assert.equal(label.text, "0042");
  assert.equal(await decodeQr(label.code), "ASN0042");
});

test("the query string round-trips and drops invalid values", () => {
  const state = {
    startNumber: 190,
    prefix: "ASN",
    leadingZeros: 3,
    borderToggle: true,
    hidePrefix: true,
  };
  assert.deepEqual(fromQuery("?" + toQuery(state)), state);
  assert.deepEqual(fromQuery("?startNumber=0&leadingZeros=x&prefix=INV"), {
    prefix: "INV",
  });
  assert.deepEqual(fromQuery("?hidePrefix=yes"), { hidePrefix: false });
  assert.match(toQuery({ ...state, hidePrefix: undefined }), /hidePrefix=false/);
  assert.deepEqual(fromQuery(""), {});
});
