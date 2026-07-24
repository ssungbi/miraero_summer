const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Set viewport to the exact container size
    await page.setViewport({
      width: 450,
      height: 800,
      deviceScaleFactor: 2, // 고해상도(레티나) 캡처
    });

    const filePath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
    console.log('Navigating to', filePath);
    
    // 웹 폰트(에스코어 드림) 및 이미지가 렌더링될 수 있도록 여유 있게 대기
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');

    console.log('Capturing screenshot of .mobile-container...');
    const element = await page.$('.mobile-container');
    const outputPath = path.resolve(__dirname, '../final_infographic.png');
    
    await element.screenshot({ path: outputPath });
    
    console.log('Successfully saved PNG to ' + outputPath);
    await browser.close();
  } catch (err) {
    console.error('Error during capture:', err);
    process.exit(1);
  }
})();
