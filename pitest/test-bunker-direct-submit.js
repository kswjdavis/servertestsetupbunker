const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Bunker Creation (Direct Submit)\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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

    // Fill form using direct JavaScript manipulation
    console.log('Step 3: Fill form with JavaScript');
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
      // Set form values directly
      document.getElementById('name').value = data.name;
      document.getElementById('latitude').value = data.latitude;
      document.getElementById('longitude').value = data.longitude;
      document.getElementById('fan_count').value = data.fan_count;
      document.getElementById('wind_threshold_mph').value = data.wind_threshold_mph;
      document.getElementById('electricity_cost_kwh').value = data.electricity_cost_kwh;
      document.getElementById('fan_power_watts').value = data.fan_power_watts;

      // Trigger change events to update React state
      const event = new Event('input', { bubbles: true });
      document.getElementById('name').dispatchEvent(event);
      document.getElementById('latitude').dispatchEvent(event);
      document.getElementById('longitude').dispatchEvent(event);
      document.getElementById('fan_count').dispatchEvent(event);
      document.getElementById('wind_threshold_mph').dispatchEvent(event);
      document.getElementById('electricity_cost_kwh').dispatchEvent(event);
      document.getElementById('fan_power_watts').dispatchEvent(event);
    }, bunkerData);

    console.log('✅ Form filled\n');

    await page.screenshot({ path: '/app/reports/direct-form-filled.png', fullPage: true });

    // Check form validity
    const formValidation = await page.evaluate(() => {
      const form = document.querySelector('form');
      return {
        isValid: form.checkValidity(),
        validationMessage: form.querySelector(':invalid')?.validationMessage || 'Form is valid'
      };
    });

    console.log('Form validation:', formValidation);

    // Submit form
    console.log('\nStep 4: Submit form');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    await page.screenshot({ path: '/app/reports/direct-after-submit.png', fullPage: true });

    if (currentUrl.includes('/bunkers/new')) {
      console.log('❌ Still on creation form - submission failed');
    } else if (currentUrl.includes('/bunkers/')) {
      console.log('✅ Redirected to bunker detail page - SUCCESS!');
    }

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: '/app/reports/direct-test-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
