const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Bunker Creation Flow\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture errors and ALL console messages
  const errors = [];
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push(`[${type.toUpperCase()}]: ${text}`);
    if (type === 'error') errors.push(`[CONSOLE]: ${text}`);
  });
  page.on('pageerror', error => {
    errors.push(`[PAGE ERROR]: ${error.message}`);
  });
  page.on('requestfailed', request => {
    errors.push(`[REQUEST FAILED]: ${request.url()}`);
  });

  try {
    // Step 1: Login
    console.log('Step 1: Login');
    await page.goto('http://frontend', { waitUntil: 'networkidle2' });
    await page.type('input[type="text"]', 'e2e-test-user');
    await page.type('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Logged in\n');

    // Step 2: Navigate to bunker creation
    console.log('Step 2: Navigate to /bunkers/new');
    await page.goto('http://frontend/bunkers/new', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[id="name"]', { timeout: 5000 });
    console.log('✅ Bunker creation form loaded\n');

    // Step 3: Fill form (clear existing values first)
    console.log('Step 3: Fill bunker form');

    // Name field
    await page.click('input[id="name"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="name"]', 'E2E Test Bunker ' + Date.now());
    console.log('  ✓ Name entered');

    // Latitude
    await page.click('input[id="latitude"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="latitude"]', '41.8781');
    console.log('  ✓ Latitude entered');

    // Longitude
    await page.click('input[id="longitude"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="longitude"]', '-87.6298');
    console.log('  ✓ Longitude entered');

    // Fan count
    await page.click('input[id="fan_count"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="fan_count"]', '3');
    console.log('  ✓ Fan count: 3');

    // Wind threshold
    await page.click('input[id="wind_threshold_mph"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="wind_threshold_mph"]', '20');
    console.log('  ✓ Wind threshold: 20 mph');

    // Electricity cost
    await page.click('input[id="electricity_cost_kwh"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="electricity_cost_kwh"]', '0.12');
    console.log('  ✓ Electricity cost: $0.12/kWh');

    // Fan power (must be multiple of 100 due to step validation)
    await page.click('input[id="fan_power_watts"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[id="fan_power_watts"]', '800');
    console.log('  ✓ Fan power: 800W');

    await page.screenshot({ path: '/app/reports/form-filled.png', fullPage: true });
    console.log('  📸 Screenshot: form-filled.png\n');

    // Step 4: Submit form
    console.log('Step 4: Submit form');
    // Click submit button using selector
    await page.click('button[type="submit"]');
    console.log('  ✓ Clicked Create Bunker button');

    // Wait for response
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);

    await page.screenshot({ path: '/app/reports/after-submit.png', fullPage: true });
    console.log('  📸 Screenshot: after-submit.png\n');

    // Check if we were redirected or stayed on form
    if (currentUrl.includes('/bunkers/new')) {
      console.log('⚠️  Still on creation form - submission may have failed');

      // Check for error messages
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.toLowerCase().includes('error')) {
        console.log('❌ Error message detected on page');
      }
    } else if (currentUrl.includes('/bunkers/')) {
      console.log('✅ Redirected to bunker detail page - SUCCESS!');
    } else if (currentUrl.includes('/dashboard')) {
      console.log('✅ Redirected to dashboard - bunker likely created');
    }

    // Print console messages and errors
    if (consoleMessages.length > 0) {
      console.log(`\n📝 Console Messages (${consoleMessages.length}):`);
      consoleMessages.slice(-20).forEach(msg => console.log(`   ${msg}`));
    }

    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} errors captured:`);
      errors.forEach(err => console.log(`   ${err}`));
    }

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: '/app/reports/test-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
