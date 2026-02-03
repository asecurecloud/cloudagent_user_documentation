/**
 * Sitemap Generator for CloudAgent Documentation
 * 
 * Scans all .mdx files in pages/ directory and generates a sitemap.xml
 * following the same _meta.json ordering as Nextra.
 * 
 * Usage: node scripts/generate-sitemap.mjs
 * 
 * Configuration:
 * - SITE_URL: Base URL for the documentation site
 * - CHANGE_FREQ: How often pages change (daily until stable, then weekly/monthly)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

// Base URL for the documentation site (update when deploying)
const SITE_URL = process.env.DOCS_SITE_URL || 'https://docs.cloudagent.io';

// Change frequency - set to 'daily' during active development
// Options: always, hourly, daily, weekly, monthly, yearly, never
const CHANGE_FREQ = 'daily';

// Priority settings by path depth
// Root pages (like /guide) get higher priority than nested pages
const PRIORITY_MAP = {
    root: '1.0',      // index.mdx at site root
    section: '0.9',   // section index pages (guide/index, cookbooks/index)
    page: '0.8',      // regular pages within sections
};

const PAGES_DIR = path.join(__dirname, '../pages');
const OUTPUT_FILE = path.join(__dirname, '../public/sitemap.xml');

// ============================================================================
// SITEMAP GENERATION
// ============================================================================

/**
 * Collects all pages from a directory following _meta.json ordering
 * @param {string} dir - Directory to scan
 * @param {string} urlPath - Current URL path (e.g., '/guide')
 * @returns {Array} Array of page objects with url, lastmod, priority
 */
function collectPages(dir, urlPath = '') {
    const pages = [];
    const metaPath = path.join(dir, '_meta.json');

    // If no _meta.json, skip this directory
    if (!fs.existsSync(metaPath)) {
        return pages;
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    for (const [key, value] of Object.entries(meta)) {
        // Skip separators and special entries
        if (key === '---') continue;
        if (typeof value === 'object' && value.type === 'separator') continue;
        
        // Skip external links (href starting with http or pointing to files like /llms.txt)
        if (typeof value === 'object' && value.href) {
            if (value.href.startsWith('http') || value.href.endsWith('.txt')) continue;
        }

        const itemPath = path.join(dir, key);
        const mdxPath = itemPath + '.mdx';
        const mdPath = itemPath + '.md';

        // Check if it's a file
        if (fs.existsSync(mdxPath) || fs.existsSync(mdPath)) {
            const filePath = fs.existsSync(mdxPath) ? mdxPath : mdPath;
            const stats = fs.statSync(filePath);
            const lastmod = stats.mtime.toISOString().split('T')[0]; // YYYY-MM-DD format

            // Determine URL path
            let pageUrl = urlPath;
            if (key === 'index') {
                // Index pages use the directory URL
                pageUrl = urlPath || '/';
            } else {
                pageUrl = `${urlPath}/${key}`;
            }

            // Determine priority
            let priority = PRIORITY_MAP.page;
            if (pageUrl === '/' || pageUrl === '') {
                priority = PRIORITY_MAP.root;
            } else if (key === 'index') {
                priority = PRIORITY_MAP.section;
            }

            pages.push({
                url: pageUrl,
                lastmod,
                priority,
                changefreq: CHANGE_FREQ,
            });
        }
        // Check if it's a directory
        else if (fs.existsSync(itemPath) && fs.lstatSync(itemPath).isDirectory()) {
            // Recursively collect pages from subdirectory
            const subPages = collectPages(itemPath, `${urlPath}/${key}`);
            pages.push(...subPages);
        }
    }

    return pages;
}

/**
 * Generates XML sitemap from collected pages
 * @param {Array} pages - Array of page objects
 * @returns {string} XML sitemap content
 */
function generateXml(pages) {
    const urlEntries = pages.map(page => {
        const fullUrl = `${SITE_URL}${page.url === '/' ? '' : page.url}`;
        return `  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}

/**
 * Main generation function
 */
function generate() {
    console.log('🗺️  Generating sitemap...');
    console.log(`   Site URL: ${SITE_URL}`);
    console.log(`   Change frequency: ${CHANGE_FREQ}`);
    console.log('');

    // Collect all pages
    const pages = collectPages(PAGES_DIR);

    // Sort by URL for consistent output
    pages.sort((a, b) => a.url.localeCompare(b.url));

    // Generate XML
    const xml = generateXml(pages);

    // Ensure public dir exists
    const publicDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write sitemap
    fs.writeFileSync(OUTPUT_FILE, xml);

    // Print summary
    console.log('📄 Pages included in sitemap:');
    console.log('');
    pages.forEach(page => {
        const displayUrl = page.url === '/' ? '/' : page.url;
        console.log(`   ${displayUrl.padEnd(40)} (priority: ${page.priority}, lastmod: ${page.lastmod})`);
    });
    console.log('');
    console.log(`✅ Successfully generated ${OUTPUT_FILE}`);
    console.log(`   Total pages: ${pages.length}`);
}

// Run the generator
generate();
