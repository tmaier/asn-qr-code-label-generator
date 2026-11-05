// The controls of the standalone page (dist/index.html) in Chromium:
// "Next Sheet" and "Hide Prefix in Label Text" update the sheet, the
// query string and the focus.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { resolveTarget, launch, openGenerator } from "./lib/print.mjs";

const target = resolveTarget();

let browser;
before(async () => {
  browser = await launch();
});
after(async () => browser?.close());

const firstText = (page) => page.locator("ol li .asn-label-text span").first().textContent();
const query = (page) => Object.fromEntries(new URL(page.url()).searchParams);

test("Next Sheet moves on by 189, updates the URL and focuses the start number", async () => {
  const page = await openGenerator(browser, { target });
  try {
    assert.equal(await firstText(page), "ASN0001");
    await page.getByRole("button", { name: "Next Sheet" }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("startNumber") === "190");
    assert.equal(await page.inputValue("#startNumber"), "190");
    assert.equal(await firstText(page), "ASN0190");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "startNumber");
    assert.match(await page.locator("form").textContent(), /start with\s+379/);
    assert.equal(query(page).startNumber, "190");
  } finally {
    await page.close();
  }
});

test("Hide Prefix prints the number alone and is kept in the URL", async () => {
  const page = await openGenerator(browser, { target });
  try {
    const qrBefore = await page.locator("ol li img").first().getAttribute("src");
    await page.check("#hidePrefix");
    await page.waitForFunction(() => new URLSearchParams(location.search).get("hidePrefix") === "true");
    assert.equal(await firstText(page), "0001");
    assert.equal(await page.locator("ol li img").first().getAttribute("src"), qrBefore, "QR code unchanged");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.isChecked("#hidePrefix"), true);
    assert.equal(await firstText(page), "0001");
  } finally {
    await page.close();
  }
});
