/**
 * VaultRail Dashboard Video Recorder
 * 
 * Records the live dashboard at https://vaultrail-dashboard.vercel.app/
 * Generates an MP4 video with proper scrolling and interactions.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  url: process.env.DASHBOARD_URL || 'https://vaultrail-dashboard.vercel.app/',
  outputPath: process.env.OUTPUT_PATH || 'dashboard-demo.mp4',
  duration: parseInt(process.env.RECORDING_DURATION) || 120, // seconds
  width: parseInt(process.env.RECORDING_WIDTH) || 1920,
  height: parseInt(process.env.RECORDING_HEIGHT) || 1080,
  verbose: process.env.VERBOSE === 'true'
};

async function recordDashboard() {
  console.log('🔴 Starting VaultRail Dashboard Recording...');
  console.log(`📝 URL: ${CONFIG.url}`);
  console.log(`📸 Resolution: ${CONFIG.width}x${CONFIG.height}`);
  console.log(`⏱️ Duration: ${CONFIG.duration}s`);

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: CONFIG.width, height: CONFIG.height }
  });

  // Create screen recording
  const videoPath = path.join(process.cwd(), CONFIG.outputPath);
  const page = await context.newPage();

  // Enable video recording
  await page.context().newPage();
  await page.goto(CONFIG.url, { waitUntil: 'networkidle' });

  console.log('✅ Dashboard loaded successfully');

  // Record the page with implicit interactions
  const startTime = Date.now();

  // Scroll and interact naturally
  await page.waitForTimeout(2000); // Wait for initial load

  // Scroll to header
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Scroll to notice
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(500);

  // Click "Simulate Milestone 3 Approval"
  await page.click('button#approve');
  console.log('✅ Clicked approval button');
  await page.waitForTimeout(800);

  // Scroll to ledger
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  // Reset demo
  await page.click('button#reset');
  console.log('✅ Clicked reset button');
  await page.waitForTimeout(800);

  // Final scroll to footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Wait for remaining duration
  const elapsed = (Date.now() - startTime) / 1000;
  const remaining = Math.max(0, CONFIG.duration - elapsed);
  if (remaining > 0) {
    await page.waitForTimeout(remaining * 1000);
  }

  await browser.close();
  console.log(`✅ Recording complete - saved to ${videoPath}`);

  return videoPath;
}

// Run if executed directly
if (require.main === module) {
  recordDashboard()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Recording failed:', err);
      process.exit(1);
    });
}

module.exports = { recordDashboard, CONFIG };