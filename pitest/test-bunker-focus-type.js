const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Bunker Creation (Focus + Type)\n');

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

    // Fill form using focus + clear + type approach
    console.log('Step 3: Fill form (focus + clear + type)');

    // Helper function to clear and type
    async function clearAndType(selector, value) {
      await page.focus(selector);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(selector, value.toString());
    }

    await clearAndType('input[id="name"]', 'E2E Test Bunker ' + Date.now());
    console.log('  ✓ Name');

    await clearAndType('input[id="latitude"]', '41.8781');
    console.log('  ✓ Latitude');

    await clearAndType('input[id="longitude"]', '-87.6298');
    console.log('  ✓ Longitude');

    await clearAndType('input[id="fan_count"]', '3');
    console.log('  ✓ Fan count');

    await clearAndType('input[id="wind_threshold_mph"]', '20');
    console.log('  ✓ Wind threshold');

    await clearAndType('input[id="electricity_cost_kwh"]', '0.12');
    console.log('  ✓ Electricity cost');

    await clearAndType('input[id="fan_power_watts"]', '800');
    console.log('  ✓ Fan power');

    await page.screenshot({ path: '/app/reports/focus-form-filled.png', fullPage: true });

    // Check what values React has in state
    const formState = await page.evaluate(() => {
      const inputs = ['name', 'latitude', 'longitude', 'fan_count', 'wind_threshold_mph', 'electricity_cost_kwh', 'fan_power_watts'];
      const values = {};
      inputs.forEach(id => {
        const el = document.getElementById(id);
        values[id] = el ? el.value : 'NOT FOUND';
      });
      return values;
    });

    console.log('\n📝 Form input values:', JSON.stringify(formState, null, 2));

    // Submit
    console.log('\nStep 4: Submit form');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/bunkers/new')) {
      console.log('❌ Still on creation form');
    } else if (currentUrl.includes('/bunkers/')) {
      console.log('✅ SUCCESS - Redirected to bunker detail page!');
    }

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: '/app/reports/focus-test-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
