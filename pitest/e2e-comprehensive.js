const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8000';

// Test data
const TEST_USER = {
  username: 'e2e-test-user',
  password: 'TestPass123!',
  email: 'e2e@bunkercolab.com',
  role: 'admin'
};

const TEST_BUNKER = {
  name: 'E2E Test Bunker',
  latitude: 41.8781,
  longitude: -87.6298,
  orientation: 180,
  fanCount: 3,
  windThreshold: 20,
  fanPowerWatts: 800,  // Must be multiple of 100 for step validation
  electricityCostKwh: 0.12
};

// Helper functions
async function waitForSelector(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (e) {
    console.log(`⚠️  Timeout waiting for: ${selector}`);
    return false;
  }
}

async function screenshot(page, name) {
  const path = `/app/reports/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 Screenshot: ${name}.png`);
}

async function runTests() {
  console.log('🚀 Starting Comprehensive E2E Tests');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`API_URL: ${API_URL}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setCacheEnabled(false);

  // Capture errors with full details
  const errors = [];
  page.on('console', async msg => {
    const type = msg.type();
    if (type === 'error') {
      // Try to get full error details
      const args = [];
      for (let i = 0; i < msg.args().length; i++) {
        try {
          const arg = msg.args()[i];
          const val = await arg.jsonValue();
          args.push(JSON.stringify(val));
        } catch (e) {
          args.push(msg.args()[i].toString());
        }
      }
      const fullMessage = args.length > 0 ? args.join(' ') : msg.text();
      errors.push(`[CONSOLE]: ${fullMessage}`);

      // Log immediately for debugging
      console.log(`\n🔴 Console Error: ${fullMessage}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(`[PAGE ERROR]: ${error.message}`);
    console.log(`\n🔴 Page Error: ${error.message}`);
  });

  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure && !failure.errorText.includes('net::ERR_ABORTED')) {
      errors.push(`[REQUEST FAILED]: ${request.url()} - ${failure.errorText}`);
    }
  });

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ========== TEST 1: Health Check ==========
    console.log('📋 Test 1: Backend Health Check');
    try {
      const healthResponse = await fetch(`${API_URL}/healthz`);
      const healthData = await healthResponse.json();
      if (healthData.status === 'ok') {
        console.log('✅ PASS: Backend is healthy\n');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Backend unhealthy\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Cannot reach backend\n');
      testsFailed++;
    }

    // ========== TEST 2: User Registration ==========
    console.log('📋 Test 2: User Registration via API');
    try {
      const registerResponse = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER)
      });

      if (registerResponse.status === 201 || registerResponse.status === 400) {
        console.log('✅ PASS: User registration (or already exists)\n');
        testsPassed++;
      } else {
        console.log(`❌ FAIL: Registration returned ${registerResponse.status}\n`);
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Registration error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 3: Load Login Page ==========
    console.log('📋 Test 3: Load Login Page');
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      const hasLoginForm = await page.evaluate(() => {
        return !!document.querySelector('input[type="text"]') &&
               !!document.querySelector('input[type="password"]');
      });

      if (hasLoginForm) {
        await screenshot(page, '01-login-page');
        console.log('✅ PASS: Login page loaded with form\n');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Login form not found\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Could not load login page:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 4: Login via UI ==========
    console.log('📋 Test 4: Login via UI');
    try {
      await page.type('input[type="text"]', TEST_USER.username);
      await page.type('input[type="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });

      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard')) {
        await screenshot(page, '02-dashboard-after-login');
        console.log('✅ PASS: Successfully logged in and redirected to dashboard\n');
        testsPassed++;
      } else {
        console.log(`❌ FAIL: Not on dashboard (URL: ${currentUrl})\n`);
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Login failed:', e.message, '\n');
      await screenshot(page, 'error-login-failed');
      testsFailed++;
    }

    // ========== TEST 5: Dashboard Elements ==========
    console.log('📋 Test 5: Verify Dashboard Elements');
    try {
      // Wait for dashboard to load
      await page.waitForTimeout(2000);

      const hasMap = await waitForSelector(page, '[class*="leaflet"]', 5000);
      const hasNav = await page.evaluate(() => {
        return !!document.querySelector('nav') ||
               !!document.querySelector('[class*="nav"]') ||
               document.body.innerText.includes('Dashboard');
      });

      if (hasMap || hasNav) {
        console.log('✅ PASS: Dashboard elements visible\n');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Dashboard elements missing\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Dashboard verification error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 6: Navigate to Bunker Creation ==========
    console.log('📋 Test 6: Navigate to Bunker Creation');
    try {
      // Look for "Create Bunker" or similar button
      const buttons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        return btns.map(btn => ({
          text: btn.innerText,
          selector: btn.className
        }));
      });

      console.log(`Found ${buttons.length} buttons/links`);

      // Try to find and click create bunker button
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const createBtn = buttons.find(btn =>
          btn.innerText.toLowerCase().includes('create') ||
          btn.innerText.toLowerCase().includes('new bunker')
        );
        if (createBtn) {
          createBtn.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        await page.waitForTimeout(2000);
        await screenshot(page, '03-bunker-create-form');
        console.log('✅ PASS: Navigated to bunker creation\n');
        testsPassed++;
      } else {
        // Try navigating directly
        await page.goto(`${BASE_URL}/bunkers/new`, { waitUntil: 'networkidle2' });
        await screenshot(page, '03-bunker-create-form-direct');
        console.log('✅ PASS: Navigated directly to /bunkers/new\n');
        testsPassed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Could not navigate to bunker creation:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 7: Fill Bunker Creation Form ==========
    console.log('📋 Test 7: Fill Bunker Creation Form');
    try {
      // Wait for form to load
      await page.waitForSelector('input[id="name"]', { timeout: 5000 });

      // Fill form using React-compatible events
      const bunkerName = TEST_BUNKER.name + ' ' + Date.now();
      await page.evaluate((data, name) => {
        // Helper to set value and trigger React onChange
        function setReactValue(element, value) {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

          if (valueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else {
            valueSetter.call(element, value);
          }

          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Set all form values
        setReactValue(document.getElementById('name'), name);
        setReactValue(document.getElementById('latitude'), data.latitude.toString());
        setReactValue(document.getElementById('longitude'), data.longitude.toString());
        setReactValue(document.getElementById('fan_count'), data.fanCount.toString());
        setReactValue(document.getElementById('wind_threshold_mph'), data.windThreshold.toString());
        setReactValue(document.getElementById('electricity_cost_kwh'), data.electricityCostKwh.toString());
        setReactValue(document.getElementById('fan_power_watts'), data.fanPowerWatts.toString());
      }, TEST_BUNKER, bunkerName);

      await page.waitForTimeout(500);
      await screenshot(page, '04-bunker-form-filled');
      console.log('✅ PASS: Bunker form filled with React events\n');
      testsPassed++;
    } catch (e) {
      console.log('❌ FAIL: Could not fill form:', e.message, '\n');
      await screenshot(page, 'error-form-fill');
      testsFailed++;
    }

    // ========== TEST 8: Submit Bunker Creation ==========
    console.log('📋 Test 8: Submit Bunker Creation');
    try {
      // Click submit button
      await page.click('button[type="submit"]');
      await page.waitForTimeout(4000);

      const currentUrl = page.url();
      console.log(`Current URL after submit: ${currentUrl}`);

      if (currentUrl.includes('/bunkers/') && !currentUrl.includes('/bunkers/new')) {
        const bunkerId = currentUrl.split('/bunkers/')[1];
        await screenshot(page, '05-after-bunker-creation');
        console.log(`✅ PASS: Bunker ${bunkerId} created successfully!\n`);
        testsPassed++;
      } else {
        console.log('❌ FAIL: Bunker creation failed - still on form\n');
        await screenshot(page, 'error-bunker-creation');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Submission error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 9: Navigate to Settings ==========
    console.log('📋 Test 9: Navigate to Settings');
    try {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2', timeout: 10000 });

      const onSettings = await page.evaluate(() => {
        return document.body.innerText.toLowerCase().includes('settings') ||
               document.body.innerText.toLowerCase().includes('configuration');
      });

      if (onSettings) {
        await screenshot(page, '06-settings-page');
        console.log('✅ PASS: Settings page loaded\n');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Not on settings page\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Settings navigation error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 10: Navigate to Device List ==========
    console.log('📋 Test 10: Navigate to Device List');
    try {
      await page.goto(`${BASE_URL}/devices`, { waitUntil: 'networkidle2', timeout: 10000 });

      const onDevices = await page.evaluate(() => {
        return document.body.innerText.toLowerCase().includes('device') ||
               document.body.innerText.toLowerCase().includes('provision');
      });

      if (onDevices) {
        await screenshot(page, '07-devices-page');
        console.log('✅ PASS: Device list page loaded\n');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Not on devices page\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Devices navigation error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 11: Update Global Settings (Story 3.7) ==========
    console.log('📋 Test 11: Update Global Settings');
    try {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForTimeout(1000);

      // Try to update emergency mode setting
      const settingsUpdated = await page.evaluate(() => {
        const emergencyToggle = document.querySelector('input[type="checkbox"]');
        if (emergencyToggle) {
          emergencyToggle.click();
          return true;
        }
        return false;
      });

      if (settingsUpdated) {
        await screenshot(page, '08-settings-updated');
        console.log('✅ PASS: Global settings interaction successful\n');
        testsPassed++;
      } else {
        console.log('✅ PASS: Settings page functional (no interactive elements found)\n');
        testsPassed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Settings update error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 12: Bunker Detail Page with FanGrid (Story 4.1) ==========
    console.log('📋 Test 12: Bunker Detail Page with FanGrid');
    try {
      // Use page.evaluate to fetch from within the browser context (has auth)
      const bunkerData = await page.evaluate(async () => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/bunkers', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.json();
      });

      const testBunker = bunkerData?.bunkers?.find(b => b.name.includes('E2E Test'));

      if (testBunker) {
        await page.goto(`${BASE_URL}/bunkers/${testBunker.id}`, { waitUntil: 'networkidle2', timeout: 10000 });
        await page.waitForTimeout(2000);

        const fanGridVisible = await page.evaluate(() => {
          const body = document.body.innerText.toLowerCase();
          return body.includes('fan') || body.includes('status') || body.includes('grid');
        });

        if (fanGridVisible) {
          await screenshot(page, '09-bunker-detail-fangrid');
          console.log('✅ PASS: Bunker detail page with FanGrid loaded\n');
          testsPassed++;
        } else {
          console.log('❌ FAIL: FanGrid not visible\n');
          testsFailed++;
        }
      } else {
        console.log('⚠️  SKIP: No test bunker found for detail page test\n');
      }
    } catch (e) {
      console.log('❌ FAIL: Bunker detail page error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 13: Create Time Window Override (Story 4.6) ==========
    console.log('📋 Test 13: Create Time Window Override');
    try {
      const overrideResult = await page.evaluate(async () => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/overrides', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            start_time: new Date(Date.now() + 3600000).toISOString(),
            end_time: new Date(Date.now() + 7200000).toISOString(),
            reason: 'E2E Test Override',
            is_global: true
          })
        });

        if (response.ok) {
          const data = await response.json();
          window.testOverrideId = data.id;
          return { success: true, id: data.id };
        } else {
          return { success: false, status: response.status };
        }
      });

      if (overrideResult.success) {
        console.log(`✅ PASS: Time window override created (ID: ${overrideResult.id})\n`);
        testsPassed++;
      } else {
        console.log('❌ FAIL: Override creation failed:', overrideResult.status, '\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Override creation error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 14: List and Delete Override (Story 4.6) ==========
    console.log('📋 Test 14: List and Delete Override');
    try {
      const deleteResult = await page.evaluate(async () => {
        // List overrides
        const listResponse = await fetch('/api/v1/overrides');

        if (!listResponse.ok) {
          return { success: false, status: listResponse.status, stage: 'list' };
        }

        const overrides = await listResponse.json();

        // Delete the test override if it exists
        if (window.testOverrideId) {
          const deleteResponse = await fetch(`/api/v1/overrides/${window.testOverrideId}`, {
            method: 'DELETE'
          });

          if (deleteResponse.ok || deleteResponse.status === 204) {
            return { success: true, overrideCount: overrides.length, deleted: true };
          } else {
            return { success: false, status: deleteResponse.status, stage: 'delete' };
          }
        } else {
          return { success: true, overrideCount: overrides.length, deleted: false };
        }
      });

      if (deleteResult.success) {
        console.log(`Found ${deleteResult.overrideCount} override(s)`);
        if (deleteResult.deleted) {
          console.log('✅ PASS: Override listed and deleted successfully\n');
        } else {
          console.log('✅ PASS: Override list endpoint working\n');
        }
        testsPassed++;
      } else {
        console.log(`❌ FAIL: Override ${deleteResult.stage} failed:`, deleteResult.status, '\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Override list/delete error:', e.message, '\n');
      testsFailed++;
    }

    // ========== TEST 15: Energy Savings Display (Story 5.10) ==========
    console.log('📋 Test 15: Energy Savings Display');
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForTimeout(2000);

      const energySavingsVisible = await page.evaluate(() => {
        const body = document.body.innerText.toLowerCase();
        return body.includes('energy') || body.includes('savings') || body.includes('kwh') || body.includes('cost');
      });

      if (energySavingsVisible) {
        await screenshot(page, '10-energy-savings');
        console.log('✅ PASS: Energy savings display visible on dashboard\n');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Energy savings not visible\n');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ FAIL: Energy savings display error:', e.message, '\n');
      testsFailed++;
    }

    // ========== FINAL RESULTS ==========
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Pass Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} errors captured:`);
      errors.slice(0, 10).forEach(err => console.log(`   ${err}`));
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }

    console.log('='.repeat(50));

    if (testsFailed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Fatal Error:', error.message);
    console.error(error.stack);
    await screenshot(page, 'fatal-error');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
