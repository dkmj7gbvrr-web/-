// Runs every tests/*.test.js file against docs/index.html served over a
// plain Node static server, with the real Firebase SDK imports swapped for
// the in-memory mock in mock-firebase/ (no network, no real Firebase
// project needed). Mirrors the sibling projects' `npm run test`, but as a
// Playwright end-to-end run instead of a unit-test run: this app has no
// build step and its logic isn't split into importable modules, so driving
// the real rendered page is the only way to exercise it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const MOCK_DIR = path.join(__dirname, 'mock-firebase');
const TESTS_DIR = path.join(__dirname, 'tests');
const PORT = 8743;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip'
};

function buildTestPage() {
  const html = fs.readFileSync(path.join(DOCS_DIR, 'index.html'), 'utf8');
  return html
    .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]*firebase-app[^'"]*\.js/, '/mock-firebase/firebase-app.js')
    .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]*firebase-firestore[^'"]*\.js/, '/mock-firebase/firebase-firestore.js');
}

function serveFile(res, filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found: ' + filePath); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function startServer() {
  const server = http.createServer(function (req, res) {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/shared-test.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildTestPage());
      return;
    }
    if (urlPath.startsWith('/mock-firebase/')) {
      serveFile(res, path.join(MOCK_DIR, urlPath.slice('/mock-firebase/'.length)));
      return;
    }
    // Anything else (vendor/pdfjs, vendor/tesseract, icons, ...) comes
    // straight from docs/, same as the real deployed site.
    serveFile(res, path.join(DOCS_DIR, urlPath));
  });
  return new Promise(function (resolve) { server.listen(PORT, function () { resolve(server); }); });
}

async function main() {
  const server = await startServer();
  const baseUrl = 'http://127.0.0.1:' + PORT;
  // CI installs its own browser via `npx playwright install chromium` (see
  // the workflow) and launch() finds it automatically. A sandboxed dev
  // environment that already has a browser elsewhere (and can't reach
  // playwright's download CDN) can point PLAYWRIGHT_CHROMIUM_PATH at it
  // instead of installing a second copy.
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOptions);

  const testFiles = fs.readdirSync(TESTS_DIR)
    .filter(function (f) { return f.endsWith('.test.js'); })
    .sort();

  let failed = 0;
  for (const file of testFiles) {
    console.log('\n=== ' + file + ' ===');
    try {
      const mod = await import(path.join(TESTS_DIR, file));
      await mod.run({ browser: browser, baseUrl: baseUrl });
      console.log('PASS: ' + file);
    } catch (e) {
      failed++;
      console.error('FAIL: ' + file + ' -- ' + e.message);
    }
  }

  await browser.close();
  server.close();

  if (failed > 0) {
    console.error('\n' + failed + ' of ' + testFiles.length + ' test file(s) failed.');
    process.exit(1);
  }
  console.log('\nAll ' + testFiles.length + ' test file(s) passed.');
}

main().catch(function (e) {
  console.error('Test run crashed:', e);
  process.exit(1);
});
