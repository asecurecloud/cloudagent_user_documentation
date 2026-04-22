/**
 * CloudAgent Documentation Screenshot Automation
 *
 * Usage:  node scripts/capture-screenshots.mjs
 * Clean:  node scripts/capture-screenshots.mjs --clean  (removes all _cc screenshots)
 *
 * Prerequisites: npx playwright install chromium
 *
 * Style guide:
 *   - Crop: Sidebar + top bar + main content (no excess whitespace)
 *   - Annotations: Light (added manually post-capture if needed)
 *   - Border: None
 *   - Resolution: 2x (Retina-quality via deviceScaleFactor)
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.join(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(DOCS_ROOT, '..');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const ROOT_ENV_FILE = path.join(WORKSPACE_ROOT, '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const rootEnv = parseEnvFile(ROOT_ENV_FILE);
const BASE_URL = process.env.CLOUDAGENT_BASE_URL || rootEnv.CLOUDAGENT_BASE_URL || 'https://cloudagent.io';
const USERNAME = process.env.CLOUDAGENT_USERNAME || rootEnv.CLOUDAGENT_USERNAME || rootEnv.username;
const PASSWORD = process.env.CLOUDAGENT_PASSWORD || rootEnv.CLOUDAGENT_PASSWORD || rootEnv.password;

const VIEWPORT = { width: 1512, height: 805 };

// Pages to capture: [filename, url path, clip height (null = full viewport)]
const PAGES = [
  ['dashboard_overview_cc',       '/dashboard/cloudagent',           null],
  ['workloads_cc',                '/dashboard/workloads',            null],
  ['cost_dashboard_cc',           '/dashboard/cost',                 null],
  ['health_dashboard_cc',         '/dashboard/health',               null],
  ['executive_summaries_cc',      '/dashboard/executive-summaries',  null],
  ['recommendations_cc',          '/dashboard/recommendations',      null],
  ['reports_cc',                  '/dashboard/reports',              null],
  ['workflows_cc',                '/dashboard/workflow-def',         null],
  ['blueprints_agents_cc',        '/dashboard/blueprints',           null],
  ['cloud_setup_cc',              '/dashboard/cloud-setup',          null],
  ['integrations_cc',             '/dashboard/integrations',         null],
  ['mcp_cc',                      '/dashboard/mcp',                  null],
];

// --clean flag: remove all previous _cc screenshots
if (process.argv.includes('--clean')) {
  console.log('Cleaning previous _cc screenshots...');
  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.includes('_cc.'));
  for (const f of files) {
    fs.unlinkSync(path.join(IMAGES_DIR, f));
    console.log(`  Deleted: ${f}`);
  }
  console.log(`Removed ${files.length} files.`);
  if (!process.argv.includes('--capture')) {
    process.exit(0);
  }
}

/**
 * Dismiss the "Getting Started" onboarding modal.
 * Source: OnboardingModal.jsx uses a Dialog with a close Button[title="Close"]
 * positioned absolute top-4 right-4 containing a Lucide <X> icon.
 */
async function dismissOnboardingModal(page) {
  try {
    // Dismiss "Getting Started" modal dialog
    const modal = await page.$('[role="dialog"]:has-text("Getting Started")');
    if (modal) {
      const closeBtn = await modal.$('button[title="Close"]');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(500);
        console.log('  Dismissed onboarding modal.');
        return true;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      console.log('  Dismissed modal via Escape.');
      return true;
    }
    // Dismiss "What best describes you?" survey modal
    const surveySkip = await page.$('text="Skip for now"');
    if (surveySkip) {
      await surveySkip.click();
      await page.waitForTimeout(500);
      console.log('  Dismissed survey modal via "Skip for now".');
      return true;
    }
  } catch {
    // No modal present
  }
  return false;
}

/**
 * Redact sensitive data from the page before taking a screenshot.
 * Keep redaction broad because docs screenshots are public.
 */
async function redactSensitiveData(page) {
  await page.evaluate(() => {
    const replaceSensitive = (input) => {
      if (!input || typeof input !== 'string') return input;
      let val = input;

      // Known private/demo names seen in the shared docs capture account.
      val = val.replace(/private_portal_tenfoldsecurity/gi, 'production-environment');
      val = val.replace(/tenfoldsecurity/gi, 'my-org');
      val = val.replace(/private_portal_dev_cloudtrail/gi, 'dev-cloudtrail');
      val = val.replace(/private_portal_dev/gi, 'dev-environment');
      val = val.replace(/private_portal_cards/gi, 'cards-environment');
      val = val.replace(/private_portal_Jumail/gi, 'staging-environment');
      val = val.replace(/private_portal_[a-zA-Z0-9_]+/gi, 'demo-environment');

      // Cloud identifiers and credentials.
      val = val.replace(/\b\d{12}\b/g, '123456789012');
      val = val.replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA****************');
      val = val.replace(/\bASIA[0-9A-Z]{16}\b/g, 'ASIA****************');
      val = val.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'user@example.com');
      val = val.replace(/arn:aws:([a-z0-9-]+):[^:\s]*:[^:\s]*:[^\s,)}\]"']*/gi,
        (match, service) => `arn:aws:${service}:us-east-1:***:***`);

      // Common visible field labels.
      val = val.replace(/\b(account|environment|workload|profile|role|external id|subscription id)(\s*[:#-]\s*)([A-Za-z0-9_.:/@-]{4,})/gi,
        (match, label, separator) => `${label}${separator}demo-value`);
      val = val.replace(/\bCloudAgentAccessRole-[A-Za-z0-9_-]+\b/g, 'CloudAgentAccessRole-demo');
      val = val.replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
        '00000000-0000-0000-0000-000000000000');

      return val;
    };

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (const tn of textNodes) {
      const val = replaceSensitive(tn.nodeValue);
      if (val !== tn.nodeValue) {
        tn.nodeValue = val;
      }
    }

    // Also redact text in input/select values
    document.querySelectorAll('input, textarea, select, [data-value], [title], [aria-label]').forEach(el => {
      if (el.value) {
        el.value = replaceSensitive(el.value);
      }
      for (const attr of ['data-value', 'title', 'aria-label']) {
        const value = el.getAttribute?.(attr);
        if (value) el.setAttribute(attr, replaceSensitive(value));
      }
    });
  });

  console.log('  Applied text redactions.');
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    throw new Error(`Missing CloudAgent login credentials. Set CLOUDAGENT_USERNAME and CLOUDAGENT_PASSWORD in ${ROOT_ENV_FILE} or the process environment.`);
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Login ---
  console.log(`Logging in with credentials from ${ROOT_ENV_FILE}...`);
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await page.fill('input[type="text"]', USERNAME);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard/**', { timeout: 15000 });
  console.log('Logged in successfully.\n');

  // Wait for initial page load, then dismiss any modal
  await page.waitForTimeout(2000);
  await dismissOnboardingModal(page);

  // --- Capture each page ---
  const results = [];
  for (const [name, urlPath, clipHeight] of PAGES) {
    const url = `${BASE_URL}${urlPath}`;
    console.log(`[${name}] Navigating to ${url}...`);

    try {
      // Use 'domcontentloaded' — some pages (e.g. dashboard/cloudagent) have
      // persistent WebSocket connections that prevent 'networkidle' from resolving.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Cost dashboard needs extra time for API data to load
      const waitTime = urlPath.includes('/cost') ? 8000 : 3000;
      await page.waitForTimeout(waitTime); // allow dynamic content to render

      // Dismiss modal if it reappears on navigation
      await dismissOnboardingModal(page);

      // Redact sensitive data before capturing
      await redactSensitiveData(page);

      const filePath = path.join(IMAGES_DIR, `${name}.png`);
      const opts = { path: filePath, type: 'png' };

      if (clipHeight) {
        opts.clip = { x: 0, y: 0, width: VIEWPORT.width, height: clipHeight };
      }

      await page.screenshot(opts);
      const size = fs.statSync(filePath).size;
      console.log(`  ✓ Saved: ${name}.png (${(size / 1024).toFixed(0)} KB)\n`);
      results.push({ name, status: 'ok', size });
    } catch (err) {
      console.error(`  ✗ FAILED: ${name} — ${err.message}\n`);
      results.push({ name, status: 'failed', error: err.message });
    }
  }

  await browser.close();

  // --- Summary ---
  const ok = results.filter(r => r.status === 'ok');
  const failed = results.filter(r => r.status === 'failed');
  console.log('='.repeat(50));
  console.log(`Done! ${ok.length}/${results.length} screenshots captured.`);
  if (failed.length) {
    console.log(`Failed: ${failed.map(f => f.name).join(', ')}`);
  }
  console.log(`Images saved to: ${IMAGES_DIR}`);
}

main().catch(console.error);
