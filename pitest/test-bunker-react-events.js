const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Bunker Creation (React Events)\n');

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

    // Fill form by triggering proper React events
    console.log('Step 3: Fill form (React-compatible events)');

    const bunkerName = 'E2E Test Bunker ' + Date.now();

    await page.evaluate((name) => {
      // Helper to set value and trigger React onChange
      function setReactValue(element, value) {
        // Get React's internal instance
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

        if (valueSetter && valueSetter !== prototypeValueSetter) {
          prototypeValueSetter.call(element, value);
        } else {
          valueSetter.call(element, value);
        }

        // Trigger React's onChange by dispatching input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Set all form values
      setReactValue(document.getElementById('name'), name);
      setReactValue(document.getElementById('latitude'), '41.8781');
      setReactValue(document.getElementById('longitude'), '-87.6298');
      setReactValue(document.getElementById('fan_count'), '3');
      setReactValue(document.getElementById('wind_threshold_mph'), '20');
      setReactValue(document.getElementById('electricity_cost_kwh'), '0.12');
      setReactValue(document.getElementById('fan_power_watts'), '800');
    }, bunkerName);

    console.log('  ✓ All fields set with React events');

    await page.waitForTimeout(500);

    // Verify input values
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

    await page.screenshot({ path: '/app/reports/react-form-filled.png', fullPage: true });

    // Submit
    console.log('\nStep 4: Submit form');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    console.log(`\nCurrent URL: ${currentUrl}`);

    if (currentUrl.includes('/bunkers/new')) {
      console.log('❌ Still on creation form - submission failed');
    } else if (currentUrl.includes('/bunkers/')) {
      const bunkerId = currentUrl.split('/bunkers/')[1];
      console.log(`✅ ✅ ✅ SUCCESS! Created bunker ${bunkerId}! ✅ ✅ ✅`);
    }

    await page.screenshot({ path: '/app/reports/react-after-submit.png', fullPage: true });

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: '/app/reports/react-test-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
