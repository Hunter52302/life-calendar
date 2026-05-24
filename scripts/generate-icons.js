/**
 * Generates 192×192 and 512×512 PNG app icons from the SVG favicon.
 * Run once: node scripts/generate-icons.js
 */
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');
const svgPath   = join(root, 'public', 'favicon.svg');
const outDir    = join(root, 'public');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);
const sizes = [192, 512];

for (const size of sizes) {
  const out = join(outDir, `icon-${size}.png`);
  await sharp(svg)
    .resize(size, size, { fit: 'contain', background: { r: 134, g: 59, b: 255, alpha: 1 } })
    .png()
    .toFile(out);
  console.log(`✓ icon-${size}.png`);
}

console.log('Icons generated.');
