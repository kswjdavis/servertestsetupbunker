const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Login first
  await page.goto('http://frontend', { waitUntil: 'networkidle2' });
  await page.type('input[type="text"]', 'e2e-test-user');
  await page.type('input[type="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Navigate to bunker creation
  await page.goto('http://frontend/bunkers/new', { waitUntil: 'networkidle2', timeout: 10000 });

  await page.waitForTimeout(2000);

  // Get page content
  const content = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      bodyText: document.body.innerText.substring(0, 800),
      forms: document.querySelectorAll('form').length,
      inputs: Array.from(document.querySelectorAll('input, textarea')).map(inp => ({
        type: inp.type,
        name: inp.name,
        id: inp.id,
        placeholder: inp.placeholder,
        className: inp.className
      })),
      buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.innerText,
        type: btn.type,
        className: btn.className
      }))
    };
  });

  console.log(JSON.stringify(content, null, 2));

  await page.screenshot({ path: '/app/reports/bunker-form-debug.png', fullPage: true });
  console.log('\n📸 Screenshot saved to bunker-form-debug.png');

  await browser.close();
})();
