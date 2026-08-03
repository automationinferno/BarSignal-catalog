#!/usr/bin/env node
/*
  Enhance legacy drink photos into standardized catalog images.

  Usage:
    node scripts/enhance-drink-images.js <srcFile> <drinkId> [<srcFile> <drinkId> ...]

  - Upscales each source photo to a 1024x1024 square, centered on a light
    neutral canvas so clear/white drinks stay visible.
  - Boosts color and contrast, then sharpens, so the drink reads clearly.
  - Writes drinks/<drinkId>.png (overwrites any existing image).

  Requirements: sharp
*/
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const CANVAS = '#eef0f0';

const DEFAULT_ENHANCE = { saturation: 1.15, brightness: 1.02, contrast: 1.06 };

// Pale, low-saturation shots need a stronger push to keep the drink visible.
const OVERRIDES = {
  manhattan: { saturation: 1.35, brightness: 1.0, contrast: 1.12 },
  martini: { saturation: 1.4, brightness: 1.0, contrast: 1.15 },
  margarita: { saturation: 1.3, brightness: 1.0, contrast: 1.1 },
};

async function ensureSharp() {
  try {
    return require('sharp');
  } catch (e) {
    console.error('Sharp is not installed. Please add it as a dependency.');
    process.exit(1);
  }
}

async function enhance(sharp, srcFile, drinkId) {
  const src = path.resolve(srcFile);
  const out = path.join(process.cwd(), 'drinks', `${drinkId}.png`);
  if (!fs.existsSync(src)) {
    console.error(`Source not found: ${src}`);
    process.exit(1);
  }

  const meta = await sharp(src).metadata();
  if (!meta.width || !meta.height) {
    console.error(`Could not read image metadata for ${src}`);
    process.exit(1);
  }

  const p = OVERRIDES[drinkId] || DEFAULT_ENHANCE;

  await sharp(src)
    .rotate()
    .resize({
      width: SIZE,
      height: SIZE,
      fit: 'contain',
      kernel: 'lanczos3',
      background: CANVAS,
    })
    .modulate({ saturation: p.saturation, brightness: p.brightness })
    .linear(p.contrast, 0)
    .sharpen({ sigma: 1.2 })
    .png({ compressionLevel: 9 })
    .toFile(out);

  const outMeta = await sharp(out).metadata();
  console.log(
    `${drinkId.padEnd(16)} ${String(meta.width).padStart(4)}x${String(meta.height).padStart(4)} -> ${outMeta.width}x${outMeta.height}  ${out}`
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.length % 2 !== 0) {
    console.error('Usage: node scripts/enhance-drink-images.js <srcFile> <drinkId> [<srcFile> <drinkId> ...]');
    process.exit(1);
  }

  const sharp = await ensureSharp();
  const drinksDir = path.join(process.cwd(), 'drinks');
  if (!fs.existsSync(drinksDir)) {
    console.error(`drinks/ directory not found in ${process.cwd()}`);
    process.exit(1);
  }

  for (let i = 0; i < args.length; i += 2) {
    await enhance(sharp, args[i], args[i + 1]);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
