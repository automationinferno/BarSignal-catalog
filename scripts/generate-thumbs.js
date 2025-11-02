#!/usr/bin/env node
/*
  Node script to generate 512px and 1024px thumbnails for each image in /drinks
  Requirements: sharp
*/
const fs = require('fs');
const path = require('path');

async function ensureSharp() {
  try {
    require.resolve('sharp');
    return require('sharp');
  } catch (e) {
    console.error('Sharp is not installed. Please add it as a dependency.');
    process.exit(1);
  }
}

async function main() {
  const sharp = await ensureSharp();
  const srcDir = path.join(process.cwd(), 'drinks');
  const outDir = path.join(srcDir, '_thumbs');
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(srcDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  if (files.length === 0) {
    console.log('No source images found in drinks/. Skipping.');
    return;
  }

  let created = 0;
  for (const f of files) {
    const base = f.replace(/\.[^.]+$/, '');
    const input = path.join(srcDir, f);

    const targets = [
      { width: 512, out: path.join(outDir, `${base}_512.png`) },
      { width: 1024, out: path.join(outDir, `${base}_1024.png`) },
    ];

    for (const t of targets) {
      const exists = fs.existsSync(t.out);
      await sharp(input)
        .resize({ width: t.width, withoutEnlargement: true })
        .png()
        .toFile(t.out);
      if (!exists) created++;
      console.log(`Wrote ${path.relative(process.cwd(), t.out)}`);
    }
  }

  console.log(`Done. Generated or updated thumbnails. New files: ${created}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
