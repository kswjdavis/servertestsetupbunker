const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  // Capture all console messages with full detail
  page.on('console', async (msg) => {
    const type = msg.type();
    if (type === 'error') {
      const text = msg.text();
      const args = [];

      for (const arg of msg.args()) {
        try {
          const val = await arg.jsonValue();
          args.push(val);
        } catch (e) {
          // If we can't get JSON value, get the string representation
          args.push(arg.toString());
        }
      }

      consoleErrors.push({
        text: text,
        args: args,
        location: msg.location()
      });

      console.log('\n🔴 CONSOLE ERROR:');
      console.log('Text:', text);
      console.log('Args:', JSON.stringify(args, null, 2));
      console.log('Location:', msg.location());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
    console.log('\n🔴 PAGE ERROR:');
    console.log('Message:', error.message);
    console.log('Stack:', error.stack);
  });

  // Register user
  console.log('\n📝 Registering user...');
  const registerResp = await fetch(`${process.env.API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'Admin123!',
      role: 'admin'
    })
  });
  console.log('Register status:', registerResp.status);

  // Navigate to login page
  console.log('\n🌐 Navigating to login page...');
  await page.goto(`${process.env.BASE_URL}/login`, { waitUntil: 'networkidle0' });

  // Login
  console.log('\n🔐 Logging in...');
  await page.type('input[id="username"]', 'admin');
  await page.type('input[id="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  console.log('\n⏱️  Current URL:', page.url());

  // Wait a few seconds to capture all errors
  console.log('\n⏱️  Waiting 5 seconds to capture errors...');
  await new Promise(r => setTimeout(r, 5000));

  // Navigate to devices page to trigger device fetch error
  console.log('\n🌐 Navigating to devices page...');
  await page.goto(`${process.env.BASE_URL}/devices`, { waitUntil: 'networkidle0' });

  console.log('\n⏱️  Waiting another 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n\n=================================');
  console.log('📊 ERROR SUMMARY');
  console.log('=================================');
  console.log(`Total console errors: ${consoleErrors.length}`);
  console.log(`Total page errors: ${pageErrors.length}`);

  await browser.close();
})();
