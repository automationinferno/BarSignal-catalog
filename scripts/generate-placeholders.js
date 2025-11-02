#!/usr/bin/env node
/*
  Generate simple placeholder PNGs for a given list of drink IDs into drinks/
*/
const fs = require('fs');
const path = require('path');

const outDir = path.join(process.cwd(), 'drinks');
fs.mkdirSync(outDir, { recursive: true });

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.log('Usage: node scripts/generate-placeholders.js <id> <id> ...');
  process.exit(0);
}

// 1x1 transparent PNG data
const png1x1 = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6360000002000150A7A1A50000000049454E44AE426082',
  'hex'
);

for (const id of ids) {
  const file = path.join(outDir, `${id}.png`);
  fs.writeFileSync(file, png1x1);
  console.log(`Wrote placeholder ${path.relative(process.cwd(), file)}`);
}
