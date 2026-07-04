/* Rasterize public/icon.svg into the PNG app icons + favicon using Playwright.
   Run: node scripts/build-icons.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUB = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(PUB, 'icon.svg'), 'utf8');

const OUT = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
];
// Extra sizes packed into favicon.ico (PNG-in-ICO).
const ICO_SIZES = [16, 32, 48];

async function renderPng(page, size) {
  const sized = svg.replace(/width="512"/, `width="${size}"`).replace(/height="512"/, `height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${sized}</body></html>`);
  const el = await page.$('svg');
  return el.screenshot();
}

// Build an .ico that embeds PNG images (widely supported by modern browsers).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, buf } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...images.map(i => i.buf)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { file, size } of OUT) {
    fs.writeFileSync(path.join(PUB, file), await renderPng(page, size));
    console.log('wrote', file, `${size}×${size}`);
  }
  const icoImages = [];
  for (const size of ICO_SIZES) icoImages.push({ size, buf: await renderPng(page, size) });
  fs.writeFileSync(path.join(PUB, 'favicon.ico'), buildIco(icoImages));
  console.log('wrote favicon.ico', ICO_SIZES.join('/'));
  await browser.close();
})();
