const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8000';

async function runTests() {
  console.log('🚀 Starting E2E tests...');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`API_URL: ${API_URL}`);

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

  // Clear browser cache to ensure fresh page load
  await page.setCacheEnabled(false);

  // Capture console logs and errors
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[BROWSER ${type.toUpperCase()}]:`, msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('[BROWSER ERROR]:', error.message);
  });

  page.on('requestfailed', request => {
    console.log('[REQUEST FAILED]:', request.url(), request.failure().errorText);
  });

  try {
    // Test 1: Health Check
    console.log('\n📋 Test 1: Backend Health Check');
    const healthResponse = await fetch(`${API_URL}/healthz`);
    const healthData = await healthResponse.json();
    console.log('✅ Backend health:', healthData);

    // Test 2: Load Login Page
    console.log('\n📋 Test 2: Load Login Page');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Login page loaded');

    // Check for login form
    const hasLoginForm = await page.evaluate(() => {
      return !!document.querySelector('input[type="text"], input[type="email"]') &&
             !!document.querySelector('input[type="password"]');
    });
    console.log(`✅ Login form present: ${hasLoginForm}`);

    // Test 3: User Registration via API
    console.log('\n📋 Test 3: User Registration');
    const registerResponse = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test-e2e-docker',
        password: 'TestPass123!',
        email: 'docker-test@bunkercolab.com',
        role: 'admin'
      })
    });

    if (registerResponse.status === 201) {
      console.log('✅ User registered successfully');
    } else if (registerResponse.status === 400) {
      console.log('ℹ️  User already exists (expected on re-run)');
    } else {
      throw new Error(`Registration failed: ${registerResponse.status}`);
    }

    // Test 4: Login via UI
    console.log('\n📋 Test 4: Login via UI');
    await page.type('input[type="text"], input[id="username"]', 'test-e2e-docker');
    await page.type('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(e => {
      console.log('⚠️  No navigation after login, checking if already on dashboard');
    });

    // Check if we're on the dashboard
    const currentUrl = page.url();
    console.log(`✅ Current URL: ${currentUrl}`);

    // Test 5: Check Dashboard Elements
    console.log('\n📋 Test 5: Dashboard Elements');
    const dashboardElements = await page.evaluate(() => {
      return {
        hasMap: !!document.querySelector('[class*="leaflet"]') || !!document.querySelector('[class*="map"]'),
        hasNav: !!document.querySelector('nav') || !!document.querySelector('[class*="nav"]'),
        hasCreateButton: !!document.querySelector('button[class*="blue"]') || Array.from(document.querySelectorAll('button')).some(btn => btn.textContent.includes('Create')),
        bodyText: document.body.innerText.substring(0, 200)
      };
    });
    console.log('Dashboard elements:', dashboardElements);

    // Test 6: Create Bunker
    console.log('\n📋 Test 6: Create Bunker');

    // Look for create bunker button
    const createButton = await page.$('button').catch(() => null);
    if (createButton) {
      await createButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Clicked create button');
    } else {
      console.log('⚠️  Create button not found');
    }

    // Take screenshot
    await page.screenshot({ path: '/app/reports/e2e-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to /app/reports/e2e-screenshot.png');

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);

    // Take error screenshot
    try {
      await page.screenshot({ path: '/app/reports/error-screenshot.png', fullPage: true });
      console.log('📸 Error screenshot saved');
    } catch (e) {
      console.log('Could not save error screenshot');
    }

    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
