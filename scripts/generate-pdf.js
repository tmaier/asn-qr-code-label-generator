const { chromium } = require('playwright');
const path = require('path');

async function generatePDF() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load the local HTML file
  const htmlPath = path.join(__dirname, '..', 'index.html');
  await page.goto(`file://${htmlPath}`);

  // Wait for AlpineJS to initialize and generate labels
  await page.waitForFunction(() => {
    const labels = document.querySelectorAll('ol li');
    return labels.length === 189; // 7 columns x 27 rows
  });

  // Wait for all QR code images to load
  await page.waitForFunction(() => {
    const images = document.querySelectorAll('ol li img');
    return Array.from(images).every(img => img.complete && img.naturalHeight > 0);
  }, { timeout: 60000 });

  // Generate PDF with A4 format and print media
  await page.pdf({
    path: 'asn-labels.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  console.log('PDF generated successfully: asn-labels.pdf');

  await browser.close();
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
