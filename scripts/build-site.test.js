/*
  Tests for scripts/build-site.js using Node's built-in test runner (no extra dependencies).
  Run: npm test
  The build is exercised with a fake encoder, so these tests never load sharp.
*/
'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { after, describe, it } = require('node:test');

const site = require('./build-site');

// Minimal lossy WebP ("VP8 " chunk) header, zero-padded to `size` bytes.
function fakeWebp(width, height = width, size = 64) {
  const buffer = Buffer.alloc(Math.max(size, 30));
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8 ', 12, 'ascii');
  buffer.writeUInt32LE(buffer.length - 20, 16);
  buffer[23] = 0x9d;
  buffer[24] = 0x01;
  buffer[25] = 0x2a;
  buffer.writeUInt16LE(width, 26);
  buffer.writeUInt16LE(height, 28);
  return buffer;
}

// Minimal lossless WebP ("VP8L" chunk) header.
function fakeWebpLossless(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8L', 12, 'ascii');
  buffer.writeUInt32LE(buffer.length - 20, 16);
  buffer[20] = 0x2f;
  buffer.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21);
  return buffer;
}

// Minimal extended WebP ("VP8X" chunk) header.
function fakeWebpExtended(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

// PNG signature + IHDR chunk (33 bytes) followed by `tag`, so every fake source hashes differently.
const PNG_HEADER_LENGTH = 33;
function fakePng(width, height, tag = '') {
  const header = Buffer.alloc(PNG_HEADER_LENGTH);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8;
  header[25] = 6;
  return Buffer.concat([header, Buffer.from(tag, 'utf8')]);
}

function sourceTag(sourceBytes) {
  return sourceBytes.subarray(PNG_HEADER_LENGTH).toString('utf8');
}

// The exact 1x1 PNG that scripts/generate-placeholders.js writes as a drink original.
const PLACEHOLDER_PNG = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6360000002000150A7A1A50000000049454E44AE426082',
  'hex',
);

// Same shape as the real drinks.json; isMocktail after imageVariants checks that key order is kept.
const ROOT_DRINKS = [
  {
    id: 'negroni',
    name: 'Negroni',
    category: 'Classic',
    popularity: 93,
    aliases: [],
    modifiersSupported: ['no_ice'],
    ingredients: [{ name: 'Gin', amount: 30, unit: 'ml' }],
    rim: null,
    tags: ['gin', 'bitter'],
    imagePath: 'drinks/negroni.png',
    imageVariants: {
      512: 'drinks/_thumbs/negroni_512.png',
      1024: 'drinks/_thumbs/negroni_1024.png',
      thumb: 'drinks/_thumbs/negroni_512.png',
    },
    isMocktail: false,
  },
  {
    id: 'old_fashioned',
    name: 'Old Fashioned',
    category: 'Classic',
    popularity: 95,
    modifiersSupported: true,
    imagePath: 'drinks/old_fashioned.png',
    imageVariants: {
      512: 'drinks/_thumbs/old_fashioned_512.png',
      1024: 'drinks/_thumbs/old_fashioned_1024.png',
      thumb: 'drinks/_thumbs/old_fashioned_512.png',
    },
  },
];

const NEGRONI_TAG = 'negroni source bytes';
const OLD_FASHIONED_TAG = 'old fashioned source bytes';
const NEGRONI_SOURCE = fakePng(1254, 1254, NEGRONI_TAG);
const OLD_FASHIONED_SOURCE = fakePng(1254, 1254, OLD_FASHIONED_TAG);
const NEGRONI_V2_SOURCE = fakePng(1254, 1254, `${NEGRONI_TAG} v2`);

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function writeFile(root, relative, content) {
  const file = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function readFile(root, relative) {
  return fs.readFileSync(path.join(root, ...relative.split('/')));
}

function readSiteCatalog(root) {
  return JSON.parse(readFile(root, 'docs/v1/drinks.json').toString('utf8'));
}

// A throwaway catalog repo: root drinks.json, source PNGs and the privacy-policy files under docs/.
// It lives in its own temp parent directory, so tests can also place files outside the repo.
function makeRepo() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'barsignal-site-'));
  tempDirs.push(parent);
  const root = path.join(parent, 'repo');
  writeFile(root, 'drinks.json', `${JSON.stringify(ROOT_DRINKS, null, 2)}\n`);
  writeFile(root, 'drinks/negroni.png', NEGRONI_SOURCE);
  writeFile(root, 'drinks/old_fashioned.png', OLD_FASHIONED_SOURCE);
  writeFile(root, 'docs/.nojekyll', '');
  writeFile(root, 'docs/privacy-policy.html', '<!doctype html><title>Privacy</title>\n');
  writeFile(root, 'docs/privacy-policy.md', '# Privacy\n');
  return root;
}

function expectedPath(id, width, sourceBytes) {
  return site.variantSitePath(id, width, site.variantHash(sourceBytes, width));
}

function fakeEncoder(calls = []) {
  return async (sourceBytes, width) => {
    calls.push({ source: sourceTag(sourceBytes), width });
    return fakeWebp(width);
  };
}

const quiet = () => {};

function buildRepo(root, encode = fakeEncoder()) {
  return site.buildSite(root, { encode, log: quiet });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('variantHash', () => {
  it('hashes the source bytes followed by "w=<width>;q=85;e=6" (known vectors)', () => {
    assert.equal(site.encodingParams(512), 'w=512;q=85;e=6');
    assert.equal(site.encodingParams(1024), 'w=1024;q=85;e=6');
    // sha256("png-bytes" + "w=512;q=85;e=6") = a4f85405..., computed independently with .NET SHA256.
    assert.equal(site.variantHash(Buffer.from('png-bytes'), 512), 'a4f85405');
    assert.equal(site.variantHash(Buffer.from('png-bytes'), 1024), '111f1aa2');
  });

  it('returns 8 lowercase hex characters that change with the bytes and the width', () => {
    const hash = site.variantHash(Buffer.from('a'), 512);
    assert.match(hash, /^[0-9a-f]{8}$/);
    assert.equal(site.variantHash(Buffer.from('a'), 512), hash);
    assert.notEqual(site.variantHash(Buffer.from('b'), 512), hash);
    assert.notEqual(site.variantHash(Buffer.from('a'), 1024), hash);
  });
});

describe('variant file names', () => {
  it('names files <id>_<width>.<hash8>.webp under img/v1/', () => {
    assert.equal(site.variantFileName('old_fashioned', 512, 'deadbeef'), 'old_fashioned_512.deadbeef.webp');
    assert.equal(site.variantSitePath('old_fashioned', 1024, '0123abcd'), 'img/v1/old_fashioned_1024.0123abcd.webp');
  });

  it('rejects ids, widths and hashes that would produce unsafe or unexpected names', () => {
    assert.throws(() => site.variantFileName('Old-Fashioned', 512, 'deadbeef'), /id/);
    assert.throws(() => site.variantFileName('../negroni', 512, 'deadbeef'), /id/);
    assert.throws(() => site.variantFileName('', 512, 'deadbeef'), /id/);
    assert.throws(() => site.variantFileName('negroni', 256, 'deadbeef'), /width/);
    assert.throws(() => site.variantFileName('negroni', 512, 'DEADBEEF'), /hash/);
    assert.throws(() => site.variantFileName('negroni', 512, 'abc'), /hash/);
  });

  it('parses valid site paths and rejects everything else', () => {
    assert.deepEqual(site.parseVariantPath('img/v1/old_fashioned_512.deadbeef.webp'), {
      id: 'old_fashioned',
      width: 512,
      hash: 'deadbeef',
    });
    assert.deepEqual(site.parseVariantPath('img/v1/negroni_1024.0123abcd.webp'), {
      id: 'negroni',
      width: 1024,
      hash: '0123abcd',
    });
    for (const bad of [
      'images/v1/negroni_512.deadbeef.webp',
      '/img/v1/negroni_512.deadbeef.webp',
      'img/v1/negroni_512.deadbeef.png',
      'img/v1/negroni_256.deadbeef.webp',
      'img/v1/negroni_512.DEADBEEF.webp',
      'img/v1/negroni_512.deadbee.webp',
      'img/v1/../negroni_512.deadbeef.webp',
      'img/v1/negroni_512.deadbeef.webp?v=2',
      'drinks/_thumbs/negroni_512.png',
      42,
      null,
    ]) {
      assert.equal(site.parseVariantPath(bad), null, String(bad));
    }
  });
});

describe('rewriteImageFields', () => {
  const paths = { 512: 'img/v1/negroni_512.aaaaaaaa.webp', 1024: 'img/v1/negroni_1024.bbbbbbbb.webp' };

  it('points imagePath and imageVariants["1024"] at the 1024 file, "512" and "thumb" at the 512 file', () => {
    const result = site.rewriteImageFields(structuredClone(ROOT_DRINKS[0]), paths);
    assert.equal(result.imagePath, paths[1024]);
    assert.deepEqual(result.imageVariants, { 512: paths[512], 1024: paths[1024], thumb: paths[512] });
  });

  it('keeps every other field and the key order, without mutating the input', () => {
    const drink = structuredClone(ROOT_DRINKS[0]);
    const result = site.rewriteImageFields(drink, paths);
    assert.deepEqual(drink, ROOT_DRINKS[0]);
    assert.deepEqual(Object.keys(result), Object.keys(drink));
    assert.deepEqual(Object.keys(result.imageVariants), Object.keys(drink.imageVariants));
    const { imagePath: _resultPath, imageVariants: _resultVariants, ...resultRest } = result;
    const { imagePath: _drinkPath, imageVariants: _drinkVariants, ...drinkRest } = drink;
    assert.deepEqual(resultRest, drinkRest);
  });

  it('rejects image variant keys it cannot map and missing image fields', () => {
    assert.throws(
      () => site.rewriteImageFields({ ...ROOT_DRINKS[1], imageVariants: { sm: 'a.png', md: 'b.png' } }, paths),
      /sm/,
    );
    assert.throws(() => site.rewriteImageFields({ ...ROOT_DRINKS[1], imageVariants: undefined }, paths), /imageVariants/);
    const { imagePath: _imagePath, ...withoutImagePath } = ROOT_DRINKS[1];
    assert.throws(() => site.rewriteImageFields(withoutImagePath, paths), /imagePath/);
  });
});

describe('renderCatalog', () => {
  it('renders deterministic 2-space JSON with LF line endings and a trailing newline', () => {
    const text = site.renderCatalog(ROOT_DRINKS);
    assert.equal(text, `${JSON.stringify(ROOT_DRINKS, null, 2)}\n`);
    assert.equal(site.renderCatalog(structuredClone(ROOT_DRINKS)), text);
    assert.ok(!text.includes('\r'));
  });
});

describe('findCatalogDrift', () => {
  const published = () =>
    ROOT_DRINKS.map((drink) =>
      site.rewriteImageFields(drink, {
        512: `img/v1/${drink.id}_512.aaaaaaaa.webp`,
        1024: `img/v1/${drink.id}_1024.bbbbbbbb.webp`,
      }),
    );

  it('accepts a published catalog whose only differences are the image fields', () => {
    assert.deepEqual(site.findCatalogDrift(ROOT_DRINKS, published()), []);
  });

  it('reports changed, added or removed non-image fields by drink id and field name', () => {
    const changed = published();
    changed[0].name = 'Negroni Sbagliato';
    const problems = site.findCatalogDrift(ROOT_DRINKS, changed);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /negroni.*name/);

    const added = published();
    added[1].themeColor = '#ffffff';
    assert.match(site.findCatalogDrift(ROOT_DRINKS, added).join('\n'), /old_fashioned.*themeColor/);

    const removed = published();
    delete removed[0].tags;
    assert.match(site.findCatalogDrift(ROOT_DRINKS, removed).join('\n'), /negroni.*tags/);
  });

  it('reports missing, extra, duplicated and reordered drinks', () => {
    assert.match(site.findCatalogDrift(ROOT_DRINKS, published().slice(0, 1)).join('\n'), /missing.*old_fashioned/);
    const extra = [...published(), { ...published()[0], id: 'mojito' }];
    assert.match(site.findCatalogDrift(ROOT_DRINKS, extra).join('\n'), /mojito/);
    const [negroni, oldFashioned] = published();
    assert.match(site.findCatalogDrift(ROOT_DRINKS, [negroni, negroni, oldFashioned]).join('\n'), /duplicate.*negroni/);
    assert.match(site.findCatalogDrift(ROOT_DRINKS, [oldFashioned, negroni]).join('\n'), /order/);
  });

  it('reports imageVariants key sets that differ from drinks.json', () => {
    const changed = published();
    delete changed[1].imageVariants.thumb;
    assert.match(site.findCatalogDrift(ROOT_DRINKS, changed).join('\n'), /old_fashioned.*imageVariants/);
  });

  it('reports a published catalog that is not an array', () => {
    assert.match(site.findCatalogDrift(ROOT_DRINKS, { drinks: [] }).join('\n'), /array/);
  });
});

describe('budgetStatus', () => {
  it('warns above 60 KB and fails above 150 KB for the 512 variant (1 KB = 1000 bytes)', () => {
    assert.equal(site.budgetStatus(512, 60_000), 'ok');
    assert.equal(site.budgetStatus(512, 60_001), 'warn');
    assert.equal(site.budgetStatus(512, 150_000), 'warn');
    assert.equal(site.budgetStatus(512, 150_001), 'fail');
  });

  it('warns above 200 KB and fails above 400 KB for the 1024 variant', () => {
    assert.equal(site.budgetStatus(1024, 200_000), 'ok');
    assert.equal(site.budgetStatus(1024, 200_001), 'warn');
    assert.equal(site.budgetStatus(1024, 400_000), 'warn');
    assert.equal(site.budgetStatus(1024, 400_001), 'fail');
  });

  it('limits the whole docs/ site to 100 MB and has no budget for other widths', () => {
    assert.equal(site.SITE_TOTAL_LIMIT, 100_000_000);
    assert.throws(() => site.budgetStatus(256, 1), /256/);
  });
});

describe('readWebpSize', () => {
  it('reads dimensions from lossy, lossless and extended WebP headers', () => {
    assert.deepEqual(site.readWebpSize(fakeWebp(512, 384)), { width: 512, height: 384 });
    assert.deepEqual(site.readWebpSize(fakeWebpLossless(1024, 1000)), { width: 1024, height: 1000 });
    assert.deepEqual(site.readWebpSize(fakeWebpExtended(1024, 1024)), { width: 1024, height: 1024 });
  });

  it('returns null for PNG bytes, truncated files and empty buffers', () => {
    assert.equal(site.readWebpSize(PLACEHOLDER_PNG), null);
    assert.equal(site.readWebpSize(fakeWebp(512).subarray(0, 20)), null);
    assert.equal(site.readWebpSize(Buffer.alloc(0)), null);
  });

  it('returns null when a VP8 chunk tag is present without the RIFF/WEBP magic', () => {
    const noRiff = fakeWebp(512);
    noRiff.write('RIFX', 0, 'ascii');
    const noWebp = fakeWebp(512);
    noWebp.write('WAVE', 8, 'ascii');
    const bare = fakeWebp(512);
    bare.fill(0, 0, 12);
    for (const buffer of [noRiff, noWebp, bare]) {
      assert.equal(buffer.toString('ascii', 12, 16), 'VP8 ');
      assert.equal(site.readWebpSize(buffer), null);
    }
  });

  it('returns null without the VP8 key-frame start code, the VP8L signature or a known chunk', () => {
    const noStartCode = fakeWebp(512);
    noStartCode[23] = 0;
    const noSignature = fakeWebpLossless(512, 512);
    noSignature[20] = 0;
    const alphaChunk = fakeWebp(512);
    alphaChunk.write('ALPH', 12, 'ascii');
    for (const buffer of [noStartCode, noSignature, alphaChunk]) assert.equal(site.readWebpSize(buffer), null);
  });
});

describe('readPngSize', () => {
  it('reads width and height from the PNG IHDR header', () => {
    assert.deepEqual(site.readPngSize(fakePng(1254, 1254)), { width: 1254, height: 1254 });
    assert.deepEqual(site.readPngSize(fakePng(800, 600, 'tag')), { width: 800, height: 600 });
    assert.deepEqual(site.readPngSize(PLACEHOLDER_PNG), { width: 1, height: 1 });
  });

  it('returns null for non-PNG bytes and truncated headers', () => {
    assert.equal(site.readPngSize(fakeWebp(512)), null);
    assert.equal(site.readPngSize(Buffer.from('plain text, definitely not a png file')), null);
    assert.equal(site.readPngSize(fakePng(1254, 1254).subarray(0, 20)), null);
    assert.equal(site.readPngSize(Buffer.alloc(0)), null);
  });
});

describe('buildSite', () => {
  it('writes a 512 and a 1024 WebP per drink and a catalog that only rewrites image fields', async () => {
    const root = makeRepo();
    const calls = [];
    const summary = await buildRepo(root, fakeEncoder(calls));
    assert.deepEqual(summary, { drinks: 2, encoded: 4, kept: 0, catalogChanged: true });
    assert.deepEqual(calls.map((call) => `${call.source}@${call.width}`).sort(), [
      `${NEGRONI_TAG}@1024`,
      `${NEGRONI_TAG}@512`,
      `${OLD_FASHIONED_TAG}@1024`,
      `${OLD_FASHIONED_TAG}@512`,
    ]);

    const catalog = readSiteCatalog(root);
    const negroni512 = expectedPath('negroni', 512, NEGRONI_SOURCE);
    const negroni1024 = expectedPath('negroni', 1024, NEGRONI_SOURCE);
    assert.equal(catalog[0].imagePath, negroni1024);
    assert.deepEqual(catalog[0].imageVariants, { 512: negroni512, 1024: negroni1024, thumb: negroni512 });
    assert.equal(catalog[1].imagePath, expectedPath('old_fashioned', 1024, OLD_FASHIONED_SOURCE));
    assert.deepEqual(site.findCatalogDrift(ROOT_DRINKS, catalog), []);
    for (const drink of catalog) {
      for (const sitePath of [drink.imagePath, ...Object.values(drink.imageVariants)]) {
        assert.match(sitePath, /^img\/v1\//);
        assert.ok(fs.existsSync(path.join(root, 'docs', sitePath)), sitePath);
      }
    }
    assert.equal(readFile(root, 'docs/v1/drinks.json').toString('utf8'), site.renderCatalog(catalog));
  });

  it('is idempotent: a second run encodes nothing and keeps the catalog byte-identical', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const first = readFile(root, 'docs/v1/drinks.json');
    const calls = [];
    const summary = await buildRepo(root, fakeEncoder(calls));
    assert.deepEqual(summary, { drinks: 2, encoded: 0, kept: 4, catalogChanged: false });
    assert.equal(calls.length, 0);
    assert.deepEqual(readFile(root, 'docs/v1/drinks.json'), first);
  });

  it('never rewrites an output that already exists', async () => {
    const root = makeRepo();
    const existing = expectedPath('negroni', 512, NEGRONI_SOURCE);
    const marker = fakeWebp(512, 512, 99);
    writeFile(root, `docs/${existing}`, marker);
    const calls = [];
    const summary = await buildRepo(root, fakeEncoder(calls));
    assert.equal(summary.kept, 1);
    assert.deepEqual(readFile(root, `docs/${existing}`), marker);
    assert.ok(!calls.some((call) => call.source === NEGRONI_TAG && call.width === 512));
  });

  it('keeps outputs from earlier builds when a source image changes', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const old512 = expectedPath('negroni', 512, NEGRONI_SOURCE);
    const old1024 = expectedPath('negroni', 1024, NEGRONI_SOURCE);
    writeFile(root, 'drinks/negroni.png', NEGRONI_V2_SOURCE);
    const summary = await buildRepo(root);
    assert.equal(summary.encoded, 2);
    assert.ok(fs.existsSync(path.join(root, 'docs', old512)));
    assert.ok(fs.existsSync(path.join(root, 'docs', old1024)));
    assert.equal(readSiteCatalog(root)[0].imagePath, expectedPath('negroni', 1024, NEGRONI_V2_SOURCE));
  });

  it('never modifies the root drinks.json or the source images', async () => {
    const root = makeRepo();
    const before = [readFile(root, 'drinks.json'), readFile(root, 'drinks/negroni.png')];
    await buildRepo(root);
    assert.deepEqual([readFile(root, 'drinks.json'), readFile(root, 'drinks/negroni.png')], before);
  });

  it('refuses to write encoder output that is not a WebP or is over budget', async () => {
    const root = makeRepo();
    await assert.rejects(site.buildSite(root, { encode: async () => Buffer.from('not a webp'), log: quiet }), /WebP/);
    await assert.rejects(
      site.buildSite(root, { encode: async (_bytes, width) => fakeWebp(width, width, 400_001), log: quiet }),
      /budget/,
    );
    assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'img', 'v1')), []);
    assert.ok(!fs.existsSync(path.join(root, 'docs', 'v1', 'drinks.json')));
  });

  it('refuses encoder output that is not exactly <width>x<width> px', async () => {
    const root = makeRepo();
    for (const encode of [
      async (_bytes, width) => fakeWebp(width - 1, width - 1),
      async (_bytes, width) => fakeWebp(width, width - 1),
      async (_bytes, width) => fakeWebpLossless(width, Math.round(width * 0.75)),
    ]) {
      await assert.rejects(site.buildSite(root, { encode, log: quiet }), /expected exactly (512x512|1024x1024) px/);
    }
    assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'img', 'v1')), []);
  });

  it('refuses to publish anything from a 1x1 placeholder original (generate-placeholders.js)', async () => {
    const root = makeRepo();
    writeFile(root, 'drinks/negroni.png', PLACEHOLDER_PNG);
    const calls = [];
    await assert.rejects(
      buildRepo(root, fakeEncoder(calls)),
      /negroni: drinks\/negroni\.png is 1x1 px, smaller than the 512 px variant/,
    );
    assert.equal(calls.length, 0);
    assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'img', 'v1')), []);
    assert.ok(!fs.existsSync(path.join(root, 'docs', 'v1', 'drinks.json')));
  });

  it('refuses the 1024 variant when the source is smaller than 1024 px', async () => {
    const root = makeRepo();
    writeFile(root, 'drinks/negroni.png', fakePng(800, 800, NEGRONI_TAG));
    await assert.rejects(buildRepo(root), (error) => {
      assert.match(error.message, /negroni: drinks\/negroni\.png is 800x800 px, smaller than the 1024 px variant/);
      assert.doesNotMatch(error.message, /smaller than the 512 px variant/);
      return true;
    });
  });

  it('refuses a source that is wide enough but too short for the square variant', async () => {
    const root = makeRepo();
    writeFile(root, 'drinks/negroni.png', fakePng(1254, 800, NEGRONI_TAG));
    const calls = [];
    await assert.rejects(buildRepo(root, fakeEncoder(calls)), (error) => {
      assert.match(error.message, /negroni: drinks\/negroni\.png is 1254x800 px, smaller than the 1024 px variant/);
      assert.doesNotMatch(error.message, /smaller than the 512 px variant/);
      return true;
    });
    assert.equal(calls.length, 0);
    assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'img', 'v1')), []);
  });

  it('requires PNG originals, because it reads the source size from the PNG header', async () => {
    const root = makeRepo();
    writeFile(root, 'drinks/negroni.png', 'plain text, not a png');
    await assert.rejects(buildRepo(root), /negroni: drinks\/negroni\.png is not a PNG/);
  });

  it('fails when a source image changes while the build is running', async () => {
    const root = makeRepo();
    let changed = false;
    const encode = async (_bytes, width) => {
      if (!changed) {
        changed = true;
        writeFile(root, 'drinks/negroni.png', NEGRONI_V2_SOURCE);
      }
      return fakeWebp(width);
    };
    await assert.rejects(site.buildSite(root, { encode, log: quiet }), /negroni: drinks\/negroni\.png changed during the build/);
  });

  it('refuses imagePath values that point outside the repository', async () => {
    const root = makeRepo();
    const outside = writeFile(path.dirname(root), 'outside.png', fakePng(1254, 1254, 'outside'));
    for (const imagePath of ['../outside.png', outside]) {
      const drinks = structuredClone(ROOT_DRINKS);
      drinks[0].imagePath = imagePath;
      writeFile(root, 'drinks.json', `${JSON.stringify(drinks, null, 2)}\n`);
      await assert.rejects(buildRepo(root), /negroni: imagePath .* points outside the repository/);
      assert.match(site.checkSite(root).errors.join('\n'), /negroni: imagePath .* points outside the repository/);
    }
  });

  it('fails with the drink id when a source image is missing', async () => {
    const root = makeRepo();
    fs.rmSync(path.join(root, 'drinks', 'old_fashioned.png'));
    await assert.rejects(buildRepo(root), /old_fashioned/);
  });

  it('requires an encoder', async () => {
    await assert.rejects(site.buildSite(makeRepo(), { log: quiet }), /encode/);
  });
});

describe('checkSite', () => {
  it('passes for a freshly built site and reports stats', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const result = site.checkSite(root);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.stats.drinks, 2);
    assert.equal(result.stats.variants[512].count, 2);
    assert.equal(result.stats.variants[1024].count, 2);
    assert.equal(result.stats.variants[512].maxBytes, 64);
    assert.equal(result.stats.imageFiles, 4);
    assert.equal(result.stats.unreferenced, 0);
    assert.ok(result.stats.siteBytes > 0);
  });

  for (const name of ['.nojekyll', 'privacy-policy.html', 'privacy-policy.md']) {
    it(`fails when docs/${name} is missing`, async () => {
      const root = makeRepo();
      await buildRepo(root);
      fs.rmSync(path.join(root, 'docs', name));
      assert.match(site.checkSite(root).errors.join('\n'), new RegExp(escapeRegExp(`docs/${name}`)));
    });
  }

  it('fails when docs/v1/drinks.json is missing', () => {
    assert.match(site.checkSite(makeRepo()).errors.join('\n'), /docs\/v1\/drinks\.json/);
  });

  it('fails when a referenced image file is missing', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const sitePath = expectedPath('negroni', 1024, NEGRONI_SOURCE);
    fs.rmSync(path.join(root, 'docs', sitePath));
    assert.match(site.checkSite(root).errors.join('\n'), new RegExp(`${escapeRegExp(sitePath)}.*missing`));
  });

  it('warns above 60 KB and fails above 150 KB for 512 images', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const sitePath = expectedPath('negroni', 512, NEGRONI_SOURCE);
    writeFile(root, `docs/${sitePath}`, fakeWebp(512, 512, 60_001));
    let result = site.checkSite(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /negroni_512/);
    writeFile(root, `docs/${sitePath}`, fakeWebp(512, 512, 150_001));
    result = site.checkSite(root);
    assert.match(result.errors.join('\n'), /negroni_512.*150 KB/);
  });

  it('warns above 200 KB and fails above 400 KB for 1024 images', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const sitePath = expectedPath('negroni', 1024, NEGRONI_SOURCE);
    writeFile(root, `docs/${sitePath}`, fakeWebp(1024, 1024, 200_001));
    let result = site.checkSite(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /negroni_1024/);
    writeFile(root, `docs/${sitePath}`, fakeWebp(1024, 1024, 400_001));
    result = site.checkSite(root);
    assert.match(result.errors.join('\n'), /negroni_1024.*400 KB/);
  });

  it('fails when docs/ is larger than the site budget', async () => {
    const root = makeRepo();
    await buildRepo(root);
    assert.match(site.checkSite(root, { siteTotalLimit: 100 }).errors.join('\n'), /docs\/ total/);
  });

  it('fails when a source image changed after the last build', async () => {
    const root = makeRepo();
    await buildRepo(root);
    writeFile(root, 'drinks/negroni.png', NEGRONI_V2_SOURCE);
    const errors = site.checkSite(root).errors.join('\n');
    assert.match(errors, /negroni/);
    assert.match(errors, /npm run build:site/);
  });

  it('fails when a non-image field drifts from the root drinks.json', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const catalog = readSiteCatalog(root);
    catalog[1].popularity = 1;
    writeFile(root, 'docs/v1/drinks.json', site.renderCatalog(catalog));
    assert.match(site.checkSite(root).errors.join('\n'), /old_fashioned.*popularity/);
  });

  it('fails when drinks.json gained a drink that was not built', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const mojito = { ...structuredClone(ROOT_DRINKS[1]), id: 'mojito', name: 'Mojito', imagePath: 'drinks/mojito.png' };
    writeFile(root, 'drinks.json', `${JSON.stringify([...ROOT_DRINKS, mojito], null, 2)}\n`);
    writeFile(root, 'drinks/mojito.png', fakePng(1254, 1254, 'mojito source bytes'));
    assert.match(site.checkSite(root).errors.join('\n'), /missing.*mojito/);
  });

  it('fails when docs/v1/drinks.json is not in the generated format', async () => {
    const root = makeRepo();
    await buildRepo(root);
    writeFile(root, 'docs/v1/drinks.json', JSON.stringify(readSiteCatalog(root), null, 4));
    assert.match(site.checkSite(root).errors.join('\n'), /npm run build:site/);
  });

  it('accepts CRLF line endings from Windows checkouts', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const text = readFile(root, 'docs/v1/drinks.json').toString('utf8');
    writeFile(root, 'docs/v1/drinks.json', text.replace(/\n/g, '\r\n'));
    assert.deepEqual(site.checkSite(root).errors, []);
  });

  it('fails when an image path does not follow img/v1/<id>_<512|1024>.<hash8>.webp', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const catalog = readSiteCatalog(root);
    catalog[0].imageVariants.thumb = catalog[0].imageVariants.thumb.replace('img/', 'images/');
    writeFile(root, 'docs/v1/drinks.json', site.renderCatalog(catalog));
    assert.match(site.checkSite(root).errors.join('\n'), /negroni.*thumb.*img\/v1\/<id>/);
  });

  it('fails when an image field points at the wrong size or at another drink', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const catalog = readSiteCatalog(root);
    catalog[0].imageVariants.thumb = catalog[0].imageVariants['1024'];
    catalog[1].imageVariants['512'] = catalog[0].imageVariants['512'];
    writeFile(root, 'docs/v1/drinks.json', site.renderCatalog(catalog));
    const errors = site.checkSite(root).errors.join('\n');
    assert.match(errors, /negroni.*thumb.*512 variant/);
    assert.match(errors, /old_fashioned.*512.*another drink/);
  });

  it('fails when a referenced file is not a WebP (even with a VP8 chunk tag) or is wider than its variant', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const sitePath = expectedPath('negroni', 512, NEGRONI_SOURCE);
    writeFile(root, `docs/${sitePath}`, PLACEHOLDER_PNG);
    assert.match(site.checkSite(root).errors.join('\n'), /negroni_512.*not a WebP/);
    const noMagic = fakeWebp(512);
    noMagic.write('RIFX', 0, 'ascii');
    writeFile(root, `docs/${sitePath}`, noMagic);
    assert.match(site.checkSite(root).errors.join('\n'), /negroni_512.*not a WebP/);
    writeFile(root, `docs/${sitePath}`, fakeWebp(1024));
    assert.match(site.checkSite(root).errors.join('\n'), /negroni_512.*1024 ?px/);
  });

  it('fails when an image is smaller than its variant, e.g. a 1x1 output of a placeholder original', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const sitePath = expectedPath('negroni', 512, NEGRONI_SOURCE);
    writeFile(root, `docs/${sitePath}`, fakeWebp(1, 1));
    assert.match(
      site.checkSite(root).errors.join('\n'),
      /negroni_512\.[0-9a-f]{8}\.webp is 1x1 px; the 512 variant must be exactly 512x512 px/,
    );
  });

  it('fails when an image is not square', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const sitePath = expectedPath('negroni', 512, NEGRONI_SOURCE);
    writeFile(root, `docs/${sitePath}`, fakeWebp(512, 384));
    assert.match(site.checkSite(root).errors.join('\n'), /negroni_512.*is 512x384 px; the 512 variant must be exactly 512x512 px/);
  });

  it('checks exact sizes for lossless (VP8L) and extended (VP8X) headers too', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const path512 = expectedPath('negroni', 512, NEGRONI_SOURCE);
    const path1024 = expectedPath('negroni', 1024, NEGRONI_SOURCE);
    writeFile(root, `docs/${path512}`, fakeWebpLossless(512, 512));
    writeFile(root, `docs/${path1024}`, fakeWebpExtended(1024, 1024));
    assert.deepEqual(site.checkSite(root).errors, []);
    writeFile(root, `docs/${path512}`, fakeWebpLossless(511, 512));
    writeFile(root, `docs/${path1024}`, fakeWebpExtended(1024, 1000));
    const errors = site.checkSite(root).errors.join('\n');
    assert.match(errors, /negroni_512.*is 511x512 px; the 512 variant must be exactly 512x512 px/);
    assert.match(errors, /negroni_1024.*is 1024x1000 px; the 1024 variant must be exactly 1024x1024 px/);
  });

  it('fails on unexpected files in docs/img/v1', async () => {
    const root = makeRepo();
    await buildRepo(root);
    writeFile(root, 'docs/img/v1/notes.txt', 'scratch');
    assert.match(site.checkSite(root).errors.join('\n'), /notes\.txt/);
  });

  it('counts outputs from earlier builds as unreferenced without failing', async () => {
    const root = makeRepo();
    await buildRepo(root);
    writeFile(root, 'drinks/negroni.png', NEGRONI_V2_SOURCE);
    await buildRepo(root);
    const result = site.checkSite(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.stats.imageFiles, 6);
    assert.equal(result.stats.unreferenced, 2);
  });

  it('checks every output in docs/img/v1, including unreferenced ones: a WebP of exactly its variant size', async () => {
    const root = makeRepo();
    await buildRepo(root);
    const old512 = 'docs/img/v1/negroni_512.00000000.webp';
    const old1024 = 'docs/img/v1/negroni_1024.00000000.webp';
    // Earlier outputs are permanent, so budgets (a policy for new outputs that may change) are not re-applied.
    writeFile(root, old512, fakeWebp(512, 512, 150_001));
    writeFile(root, old1024, fakeWebpExtended(1024, 1024));
    const result = site.checkSite(root);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.stats.unreferenced, 2);
    writeFile(root, old512, fakeWebp(1, 1));
    writeFile(root, old1024, PLACEHOLDER_PNG);
    const errors = site.checkSite(root).errors.join('\n');
    assert.match(errors, /docs\/img\/v1\/negroni_512\.00000000\.webp is 1x1 px; the 512 variant must be exactly 512x512 px/);
    assert.match(errors, /docs\/img\/v1\/negroni_1024\.00000000\.webp is not a WebP file/);
  });
});

describe('main (CLI)', () => {
  it('--check exits 0 for a valid site and 1 when the check fails', async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const root = makeRepo();
    await buildRepo(root);
    assert.equal(await site.main(['--check'], root), 0);
    fs.rmSync(path.join(root, 'docs', '.nojekyll'));
    assert.equal(await site.main(['--check'], root), 1);
  });

  it('rejects unknown arguments with exit code 2', async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    assert.equal(await site.main(['--chek'], makeRepo()), 2);
  });

  // Self-contained: a fresh Node process loads build-site.js, runs a build with an injected encoder,
  // checkSite and `main(['--check'])`, then reports whether sharp ever entered its module cache.
  it('never loads sharp for --check or when an encoder is injected (fresh process)', () => {
    const root = makeRepo();
    const child = `
      'use strict';
      const site = require(${JSON.stringify(path.join(__dirname, 'build-site.js'))});
      const fakeWebp = ${fakeWebp.toString()};
      (async () => {
        const root = process.argv[1];
        await site.buildSite(root, { encode: async (_bytes, width) => fakeWebp(width), log: () => {} });
        const { errors } = site.checkSite(root);
        console.log = () => {};
        console.error = () => {};
        const code = await site.main(['--check'], root);
        const loaded = Object.keys(require.cache).filter((file) => /[\\\\/]node_modules[\\\\/]sharp[\\\\/]/.test(file));
        process.stdout.write(JSON.stringify({ errors, code, loaded }));
      })().catch((error) => {
        process.stderr.write(String((error && error.stack) || error));
        process.exit(1);
      });
    `;
    const run = spawnSync(process.execPath, ['-e', child, root], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), { errors: [], code: 0, loaded: [] });
  });
});
