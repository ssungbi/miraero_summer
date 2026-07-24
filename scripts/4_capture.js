'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE:${name}`);
  return value;
}

function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : null,
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' : null,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) throw new Error('CHROME_EXECUTABLE_NOT_FOUND');
  return executable;
}

async function main() {
  const baseDir = path.resolve(__dirname, '..');
  const inputPath = path.resolve(argumentValue('--input', path.join(baseDir, 'index.html')));
  const outputPath = path.resolve(
    argumentValue('--output', path.join(baseDir, 'final_infographic.png'))
  );
  if (!fs.existsSync(inputPath)) throw new Error(`HTML_INPUT_NOT_FOUND:${inputPath}`);

  const executablePath = resolveChromeExecutable();
  const startedAt = Date.now();
  const args = ['--disable-dev-shm-usage'];
  if (process.env.PUPPETEER_NO_SANDBOX === '1') {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 450,
      height: 800,
      deviceScaleFactor: 2
    });
    await page.goto(pathToFileURL(inputPath).href, {
      waitUntil: 'load',
      timeout: 60000
    });
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((_, reject) => (
        setTimeout(() => reject(new Error('FONT_LOAD_TIMEOUT')), 30000)
      ))
    ]);

    const renderState = await page.evaluate(() => {
      const container = document.querySelector('.mobile-container');
      const banner = document.querySelector('.banner-img');
      const rect = container?.getBoundingClientRect();
      return {
        container: rect ? { width: rect.width, height: rect.height } : null,
        bannerLoaded: Boolean(banner && banner.complete && banner.naturalWidth > 0),
        rowCount: document.querySelectorAll('tr.data-row').length
      };
    });
    if (!renderState.container) throw new Error('MOBILE_CONTAINER_NOT_FOUND');
    if (
      renderState.container.width !== 450 ||
      renderState.container.height !== 800
    ) {
      throw new Error(`MOBILE_CONTAINER_SIZE_UNEXPECTED:${JSON.stringify(renderState.container)}`);
    }
    if (!renderState.bannerLoaded) throw new Error('BANNER_NOT_LOADED');
    if (renderState.rowCount < 1 || renderState.rowCount > 20) {
      throw new Error(`RANKING_ROW_COUNT_UNEXPECTED:${renderState.rowCount}`);
    }

    const element = await page.$('.mobile-container');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await element.screenshot({ path: outputPath });

    const stat = fs.statSync(outputPath);
    if (stat.size <= 0 || stat.mtimeMs < startedAt - 1000) {
      throw new Error('PNG_OUTPUT_NOT_FRESH');
    }

    process.stdout.write(`${JSON.stringify({
      status: 'PNG_CAPTURED',
      input: inputPath,
      output: outputPath,
      bytes: stat.size,
      width: 900,
      height: 1600,
      rowCount: renderState.rowCount,
      chrome: executablePath
    })}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
