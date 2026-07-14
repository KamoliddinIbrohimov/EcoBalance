#!/usr/bin/env node
/**
 * One-off script to compress brand assets (logo.png, eco-city.png).
 * Run inside the web container:
 *   docker compose exec web node --experimental-specifier-resolution=node /tmp/optimize-brand.mjs
 */
import fs from 'node:fs';

const sharp = (await import(process.env.SHARP_PATH ?? '/tmp/node_modules/sharp/dist/index.cjs')).default;

const PUBLIC = '/workspace/apps/web/public';

async function stat(file) {
  try { return fs.statSync(file).size; } catch { return null; }
}

async function optimizeLogo() {
  const src = `${PUBLIC}/logo.png`;
  const before = await stat(src);
  const buf = await sharp(src)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  fs.writeFileSync(src, buf);
  const after = await stat(src);
  console.log(`logo.png    ${before} → ${after} bytes (${Math.round((1 - after/before) * 100)}% saved)`);
}

async function optimizeCity() {
  const src = `${PUBLIC}/eco-city.png`;
  const before = await stat(src);

  const webp = await sharp(src)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();
  fs.writeFileSync(`${PUBLIC}/eco-city.webp`, webp);

  // also produce a smaller optimised PNG fallback (in case someone hits it directly)
  const pngOpt = await sharp(src)
    .resize({ width: 1600, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 85 })
    .toBuffer();
  fs.writeFileSync(src, pngOpt);

  const afterWebp = await stat(`${PUBLIC}/eco-city.webp`);
  const afterPng  = await stat(src);
  console.log(`eco-city.png  ${before} → ${afterPng} bytes  (${Math.round((1 - afterPng/before) * 100)}% saved)`);
  console.log(`eco-city.webp                → ${afterWebp} bytes`);
}

await optimizeLogo();
await optimizeCity();
