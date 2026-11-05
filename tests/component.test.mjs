// Unit tests for src/component.js and the package entry point, without a
// browser or Alpine: the component is a plain object.

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import * as pkg from "../src/index.js";
import { asnLabels } from "../src/component.js";
import { PER_SHEET } from "../src/labels.js";

// Minimal stand-ins for the browser globals the component reads.
function browser({ search = "", stored = {} } = {}) {
  const store = new Map(Object.entries(stored).map(([k, v]) => [k, JSON.stringify(v)]));
  globalThis.location = { search };
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
  };
  return store;
}
afterEach(() => {
  delete globalThis.location;
  delete globalThis.localStorage;
});

const fields = (c) => ({
  startNumber: c.startNumber,
  prefix: c.prefix,
  leadingZeros: c.leadingZeros,
  borderToggle: c.borderToggle,
  hidePrefix: c.hidePrefix,
});

test("the package exports the label logic and the component", () => {
  for (const name of ["asnLabels", "labelText", "displayText", "nextSheetStart", "parseCount", "sheet", "qrSvg", "qrDataUri", "fromQuery", "toQuery", "DEFAULTS", "COLUMNS", "ROWS", "PER_SHEET"]) {
    assert.ok(name in pkg, `missing export ${name}`);
  }
});

test("starts with the defaults, number fields as strings", () => {
  browser();
  assert.deepEqual(fields(asnLabels()), { startNumber: "1", prefix: "ASN", leadingZeros: "3", borderToggle: false, hidePrefix: false });
});

test("the query string wins over localStorage", () => {
  browser({
    search: "?startNumber=190&prefix=INV",
    stored: { "asn-labels-v1": { startNumber: 379, prefix: "X", leadingZeros: 5, borderToggle: true } },
  });
  assert.deepEqual(fields(asnLabels()), { startNumber: "190", prefix: "INV", leadingZeros: "5", borderToggle: true, hidePrefix: false });
});

test("storageKey picks the key, null ignores localStorage", () => {
  const stored = { mine: { startNumber: 379 }, "asn-labels-v1": { startNumber: 568 } };
  browser({ stored });
  assert.equal(asnLabels({ storageKey: "mine" }).startNumber, "379");
  assert.equal(asnLabels({ storageKey: null }).startNumber, "1");
});

test("labels, first and the next sheet follow the fields", () => {
  browser();
  const c = asnLabels({ storageKey: null });
  c.startNumber = "190";
  assert.equal(c.labels.length, PER_SHEET);
  assert.deepEqual(Object.keys(c.labels[0]), ["code", "text", "col", "row", "qr"]);
  assert.equal(c.labels[0].text, "ASN0190");
  assert.match(c.labels[0].qr, /^data:image\/svg\+xml,/);
  assert.equal(c.first, "ASN0190");
  assert.match(c.startHint, /next one starts at 379/);
  c.nextSheet();
  assert.equal(c.startNumber, "379");
  c.reset();
  assert.deepEqual(fields(c), { startNumber: "1", prefix: "ASN", leadingZeros: "3", borderToggle: false, hidePrefix: false });
});

test("an invalid field empties the sheet", () => {
  browser();
  const c = asnLabels({ storageKey: null });
  c.leadingZeros = "-1";
  assert.equal(c.valid("leadingZeros"), false);
  assert.equal(c.ok, false);
  assert.equal(c.state, null);
  assert.deepEqual(c.labels, []);
  assert.equal(c.first, "–");
  c.nextSheet();
  assert.equal(c.startNumber, "1");
});

test("hidePrefix comes from the query string and localStorage", () => {
  browser({ search: "?hidePrefix=true" });
  assert.equal(asnLabels({ storageKey: null }).hidePrefix, true);
  browser({ stored: { "asn-labels-v1": { hidePrefix: true } } });
  assert.equal(asnLabels().hidePrefix, true);
  browser({ search: "?hidePrefix=false", stored: { "asn-labels-v1": { hidePrefix: true } } });
  assert.equal(asnLabels().hidePrefix, false);
});

test("hidePrefix prints the number alone, the QR code keeps the prefix", () => {
  browser();
  const c = asnLabels({ storageKey: null });
  const before = c.labels[0];
  c.hidePrefix = true;
  assert.deepEqual(c.state, { startNumber: 1, prefix: "ASN", leadingZeros: 3, borderToggle: false, hidePrefix: true });
  const [label] = c.labels;
  assert.equal(label.code, "ASN0001");
  assert.equal(label.text, "0001");
  assert.equal(label.qr, before.qr, "same QR code as with the prefix shown");
  assert.equal(c.first, "0001");
  c.reset();
  assert.equal(c.hidePrefix, false);
});

test("nextSheet moves on by one sheet, keeps the URL in sync and focuses the start number", () => {
  browser();
  const urls = [];
  globalThis.history = { replaceState: (_s, _t, url) => urls.push(url) };
  globalThis.document = {};
  try {
    const c = asnLabels({ storageKey: null });
    const watchers = new Map();
    let focused = 0;
    Object.assign(c, {
      $watch: (expr, fn) => watchers.set(expr, fn),
      $nextTick: () => {},
      $refs: { startNumber: { focus: () => focused++ } },
    });
    c.init();
    c.nextSheet();
    assert.equal(c.startNumber, "190");
    assert.equal(c.labels[0].text, "ASN0190");
    assert.equal(focused, 1);
    watchers.get("state")(c.state);
    assert.equal(urls.at(-1), "?startNumber=190&prefix=ASN&leadingZeros=3&borderToggle=false&hidePrefix=false");
  } finally {
    delete globalThis.history;
    delete globalThis.document;
  }
});
