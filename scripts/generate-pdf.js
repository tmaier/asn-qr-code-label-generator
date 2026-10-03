const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TOTAL_CELLS = 7 * 27; // 189
const EXPECTED_BARCODES = 94;

async function generatePDF() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Serve index.html and rewrite CDN script tags are loaded from network.
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Server started on port ${port}`);

  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });

    console.log('Waiting for label grid...');
    await page.waitForFunction(
      (total) => document.querySelectorAll('ol li').length === total,
      TOTAL_CELLS,
      { timeout: 60000 }
    );

    console.log('Waiting for Code 128 SVGs...');
    await page.waitForFunction(
      (expected) => {
        const barcodes = document.querySelectorAll('ol li[data-kind="barcode"] svg');
        if (barcodes.length !== expected) return false;
        return Array.from(barcodes).every(
          (svg) => svg.querySelectorAll('rect, path, g').length > 0
        );
      },
      EXPECTED_BARCODES,
      { timeout: 120000 }
    );

    const kinds = await page.$$eval('ol li', (nodes) =>
      nodes.map((n) => n.getAttribute('data-kind'))
    );
    const barcodeCount = kinds.filter((k) => k === 'barcode').length;
    const textCount = kinds.filter((k) => k === 'text').length;
    const emptyCount = kinds.filter((k) => k === 'empty').length;
    console.log(
      `Grid OK: barcode=${barcodeCount} text=${textCount} empty=${emptyCount}`
    );

    console.log('Generating PDF...');
    await page.pdf({
      path: 'asn-labels.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    console.log('PDF generated successfully: asn-labels.pdf');
  } finally {
    await browser.close();
    server.close();
  }
}

generatePDF().catch((err) => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
