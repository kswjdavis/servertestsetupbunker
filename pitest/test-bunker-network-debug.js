const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Bunker Creation (Network Debug)\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture network requests and responses
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/api/v1/bunkers')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/v1/bunkers')) {
      const status = response.status();
      const headers = response.headers();
      let body = null;
      try {
        body = await response.json();
      } catch (e) {
        body = await response.text();
      }

      console.log('\n📡 API Response:');
      console.log('Status:', status);
      console.log('Body:', JSON.stringify(body, null, 2));
    }
  });

  try {
    // Login
    console.log('Step 1: Login');
    await page.goto('http://frontend', { waitUntil: 'networkidle2' });
    await page.type('input[type="text"]', 'e2e-test-user');
    await page.type('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Logged in\n');

    // Navigate to bunker creation
    console.log('Step 2: Navigate to /bunkers/new');
    await page.goto('http://frontend/bunkers/new', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[id="name"]', { timeout: 5000 });
    console.log('✅ Form loaded\n');

    // Fill form
    console.log('Step 3: Fill form');
    const bunkerData = {
      name: 'E2E Test Bunker ' + Date.now(),
      latitude: 41.8781,
      longitude: -87.6298,
      fan_count: 3,
      wind_threshold_mph: 20,
      electricity_cost_kwh: 0.12,
      fan_power_watts: 800
    };

    await page.evaluate((data) => {
      document.getElementById('name').value = data.name;
      document.getElementById('latitude').value = data.latitude;
      document.getElementById('longitude').value = data.longitude;
      document.getElementById('fan_count').value = data.fan_count;
      document.getElementById('wind_threshold_mph').value = data.wind_threshold_mph;
      document.getElementById('electricity_cost_kwh').value = data.electricity_cost_kwh;
      document.getElementById('fan_power_watts').value = data.fan_power_watts;

      // Trigger React change events
      const event = new Event('input', { bubbles: true });
      ['name', 'latitude', 'longitude', 'fan_count', 'wind_threshold_mph', 'electricity_cost_kwh', 'fan_power_watts'].forEach(id => {
        document.getElementById(id).dispatchEvent(event);
      });
    }, bunkerData);

    console.log('✅ Form filled\n');

    // Submit and wait for API call
    console.log('Step 4: Submit form');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Print captured requests
    console.log('\n📡 Captured Requests:');
    requests.forEach(req => {
      console.log(`\nMethod: ${req.method}`);
      console.log(`URL: ${req.url}`);
      console.log(`POST Data: ${req.postData}`);
    });

    const currentUrl = page.url();
    console.log(`\nCurrent URL: ${currentUrl}`);

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
})();
