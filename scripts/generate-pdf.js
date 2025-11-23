const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function generatePDF() {
  // Start a simple HTTP server to serve the HTML file
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Server started on port ${port}`);

  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Load the page from local server and wait for network to settle
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });

    // Wait for AlpineJS to initialize and generate labels
    console.log('Waiting for labels to be generated...');
    await page.waitForFunction(() => {
      const labels = document.querySelectorAll('ol li');
      return labels.length === 189; // 7 columns x 27 rows
    }, { timeout: 60000 });

    console.log('Labels generated, waiting for QR code images to load...');

    // Wait for all QR code images to load
    await page.waitForFunction(() => {
      const images = document.querySelectorAll('ol li img');
      if (images.length === 0) return false;
      return Array.from(images).every(img => img.complete && img.naturalHeight > 0);
    }, { timeout: 120000 });

    console.log('All images loaded, generating PDF...');

    // Generate PDF with A4 format and print media
    await page.pdf({
      path: 'asn-labels.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    console.log('PDF generated successfully: asn-labels.pdf');
  } finally {
    await browser.close();
    server.close();
  }
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
