import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGES_DIR = path.join(__dirname, '../pages');
const OUTPUT_FILE = path.join(__dirname, '../public/llms.txt');

const HEADER = `---
title: CloudAgent Documentation
description: Consolidated documentation for CloudAgent, optimized for LLM consumption.
generated_at: ${new Date().toISOString()}
---

# CloudAgent Documentation

This is a consolidated version of the CloudAgent documentation.
It includes the User Guide, Cookbooks, and other resources.

---

`;

function cleanMdx(content) {
    // Remove imports
    content = content.replace(/^import\s+.*$/gm, '');
    // Remove exports
    content = content.replace(/^export\s+.*$/gm, '');
    // Remove <Callout> components but keep content
    content = content.replace(/<Callout.*?>/g, '> **Note:** ');
    content = content.replace(/<\/Callout>/g, '');
    // Remove extra newlines
    return content.replace(/\n{3,}/g, '\n\n').trim();
}

function processDirectory(dir) {
    let content = '';
    const metaPath = path.join(dir, '_meta.json');

    if (!fs.existsSync(metaPath)) {
        return content;
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    for (const [key, value] of Object.entries(meta)) {
        if (key === '---') continue; // Skip separators

        const itemPath = path.join(dir, key);
        const mdxPath = itemPath + '.mdx';
        const mdPath = itemPath + '.md';

        if (typeof value === 'string') {
            // It's a page or a directory title
            if (fs.existsSync(mdxPath)) {
                const fileContent = fs.readFileSync(mdxPath, 'utf8');
                content += `\n\n# ${value}\n\n${cleanMdx(fileContent)}`;
            } else if (fs.existsSync(mdPath)) {
                const fileContent = fs.readFileSync(mdPath, 'utf8');
                content += `\n\n# ${value}\n\n${cleanMdx(fileContent)}`;
            } else if (fs.existsSync(itemPath) && fs.lstatSync(itemPath).isDirectory()) {
                // It's a directory
                content += `\n\n# ${value}\n`;
                content += processDirectory(itemPath);
            }
        } else if (typeof value === 'object') {
            // It's a structured item (like a link or separator, or advanced config)
            if (value.type === 'separator') continue;

            // If it has a title and points to a file/dir
            if (value.title) {
                if (fs.existsSync(mdxPath)) {
                    const fileContent = fs.readFileSync(mdxPath, 'utf8');
                    content += `\n\n# ${value.title}\n\n${cleanMdx(fileContent)}`;
                } else if (fs.existsSync(itemPath) && fs.lstatSync(itemPath).isDirectory()) {
                    content += `\n\n# ${value.title}\n`;
                    content += processDirectory(itemPath);
                }
            }
        }
    }
    return content;
}

function generate() {
    console.log('Generating LLM documentation...');
    let fullContent = HEADER;
    fullContent += processDirectory(PAGES_DIR);

    // Ensure public dir exists
    const publicDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, fullContent);
    console.log(`Successfully generated ${OUTPUT_FILE}`);
}

generate();
