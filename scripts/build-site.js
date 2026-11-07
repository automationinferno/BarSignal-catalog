#!/usr/bin/env node
/*
  Build or check the GitHub Pages site under docs/ (Pages source: main:/docs).

    npm run build:site   encode missing WebP images, write docs/v1/drinks.json, then run the check
    npm run check:site   offline check only: Node built-ins, no install needed, never loads sharp

  Inputs (authoring source, never modified): drinks.json and the source image each drink's imagePath names.
  Outputs, relative to the site root docs/ (https://automationinferno.github.io/BarSignal-catalog/):
    v1/drinks.json                        same schema as drinks.json; only imagePath and imageVariants change
    img/v1/<id>_<512|1024>.<hash8>.webp   WebP q85, effort 6, flattened; the 512 file backs imageVariants
                                          "512" and "thumb", the 1024 file backs "1024" and imagePath
  hash8 = first 8 hex characters of sha256(source image bytes + "w=<width>;q=85;e=6").
  Every output must be exactly <width>x<width> px, so sources must be PNG originals of at least 1024x1024 px;
  the build refuses smaller sources (e.g. 1x1 placeholders) instead of upscaling or publishing tiny files.
  Image outputs are append-only: never rewritten or deleted, because released app builds reference them.
  Budgets (1 KB = 1000 bytes): 512 warns above 60 KB and fails above 150 KB, 1024 warns above 200 KB
  and fails above 400 KB, and the whole docs/ tree fails above 100 MB.
*/
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');

const REPO_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = 'docs';
const IMAGE_DIR = 'img/v1';
const CATALOG_FILE = 'v1/drinks.json';
const REQUIRED_SITE_FILES = {
  '.nojekyll': 'without it GitHub Pages runs Jekyll over docs/; never delete it',
  'privacy-policy.html': 'it is the published privacy policy URL',
  'privacy-policy.md': 'older app versions link to it',
};
const WIDTHS = [512, 1024];
const WEBP_QUALITY = 85;
const WEBP_EFFORT = 6;
const KB = 1000;
const MB = 1000 * KB;
const BUDGETS = {
  512: { warn: 60 * KB, fail: 150 * KB },
  1024: { warn: 200 * KB, fail: 400 * KB },
};
const SITE_TOTAL_LIMIT = 100 * MB;
const IMAGE_PATH_WIDTH = 1024;
const VARIANT_KEY_WIDTHS = new Map([
  ['512', 512],
  ['1024', 1024],
  ['thumb', 512],
]);
const IMAGE_FIELDS = ['imagePath', 'imageVariants'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_HEADER_BYTES = 24; // signature + IHDR length, type, width and height
const WEBP_HEADER_BYTES = 30; // RIFF/WEBP magic + first chunk header up to the canvas size
const ID_PATTERN = /^[a-z0-9_]+$/;
const HASH_PATTERN = /^[0-9a-f]{8}$/;
const FILE_NAME_PATTERN = /^([a-z0-9_]+)_(512|1024)\.([0-9a-f]{8})\.webp$/;
const PATH_PATTERN_TEXT = `${IMAGE_DIR}/<id>_<512|1024>.<hash8>.webp`;
const CATALOG_LABEL = `${SITE_DIR}/${CATALOG_FILE}`;
const USAGE = 'Usage: node scripts/build-site.js [--check]';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function encodingParams(width) {
  return `w=${width};q=${WEBP_QUALITY};e=${WEBP_EFFORT}`;
}

function variantHash(sourceBytes, width) {
  return crypto.createHash('sha256').update(sourceBytes).update(encodingParams(width)).digest('hex').slice(0, 8);
}

function variantFileName(id, width, hash) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error(`invalid drink id ${JSON.stringify(id)}: use lowercase snake_case`);
  }
  if (!WIDTHS.includes(width)) {
    throw new Error(`invalid width ${width}: expected one of ${WIDTHS.join(', ')}`);
  }
  if (typeof hash !== 'string' || !HASH_PATTERN.test(hash)) {
    throw new Error(`invalid hash ${JSON.stringify(hash)}: expected 8 lowercase hex characters`);
  }
  return `${id}_${width}.${hash}.webp`;
}

// Paths are relative to the site root and must not start with "images/": the app's normalizePath() strips it.
function variantSitePath(id, width, hash) {
  return `${IMAGE_DIR}/${variantFileName(id, width, hash)}`;
}

function parseVariantPath(sitePath) {
  if (typeof sitePath !== 'string' || !sitePath.startsWith(`${IMAGE_DIR}/`)) return null;
  const match = FILE_NAME_PATTERN.exec(sitePath.slice(IMAGE_DIR.length + 1));
  return match ? { id: match[1], width: Number(match[2]), hash: match[3] } : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Returns a copy of the drink with the same keys in the same order; only the image fields change.
function rewriteImageFields(drink, paths) {
  if (!isPlainObject(drink)) throw new Error('drink must be an object');
  if (typeof drink.imagePath !== 'string' || drink.imagePath === '') {
    throw new Error('imagePath must be a non-empty string');
  }
  if (!isPlainObject(drink.imageVariants) || Object.keys(drink.imageVariants).length === 0) {
    throw new Error('imageVariants must be an object with at least one variant');
  }
  const imageVariants = {};
  for (const key of Object.keys(drink.imageVariants)) {
    if (!VARIANT_KEY_WIDTHS.has(key)) {
      throw new Error(`unsupported imageVariants key "${key}" (build-site maps ${[...VARIANT_KEY_WIDTHS.keys()].join(', ')})`);
    }
    imageVariants[key] = paths[VARIANT_KEY_WIDTHS.get(key)];
  }
  const result = {};
  for (const key of Object.keys(drink)) {
    if (key === 'imagePath') result[key] = paths[IMAGE_PATH_WIDTH];
    else if (key === 'imageVariants') result[key] = imageVariants;
    else result[key] = drink[key];
  }
  return result;
}

function renderCatalog(drinks) {
  return `${JSON.stringify(drinks, null, 2)}\n`;
}

function withoutImageFields(drink) {
  const rest = { ...drink };
  for (const field of IMAGE_FIELDS) delete rest[field];
  return rest;
}

function variantKeys(drink) {
  return isPlainObject(drink.imageVariants) ? Object.keys(drink.imageVariants).join(',') : '';
}

function listIds(ids) {
  return ids.map((id) => String(id)).join(', ');
}

// Same drinks, same ids, same order and the same non-image fields as the root drinks.json.
function findCatalogDrift(rootDrinks, siteDrinks) {
  if (!Array.isArray(rootDrinks)) return ['drinks.json must contain an array of drinks'];
  if (!Array.isArray(siteDrinks)) return [`${CATALOG_LABEL} must contain an array of drinks`];

  const problems = [];
  const idOf = (drink) => (isPlainObject(drink) ? drink.id : undefined);
  const rootIds = rootDrinks.map(idOf);
  const siteIds = siteDrinks.map(idOf);
  const rootIdSet = new Set(rootIds);
  const siteIdSet = new Set(siteIds);
  const missing = rootIds.filter((id) => !siteIdSet.has(id));
  const extra = siteIds.filter((id) => !rootIdSet.has(id));
  const duplicates = [...new Set(siteIds.filter((id, index) => siteIds.indexOf(id) !== index))];
  if (missing.length > 0) problems.push(`${CATALOG_LABEL} is missing drinks from drinks.json: ${listIds(missing)}`);
  if (extra.length > 0) problems.push(`${CATALOG_LABEL} has drinks that are not in drinks.json: ${listIds(extra)}`);
  if (duplicates.length > 0) problems.push(`${CATALOG_LABEL} has duplicate drink ids: ${listIds(duplicates)}`);
  if (missing.length + extra.length + duplicates.length === 0 && rootIds.some((id, index) => siteIds[index] !== id)) {
    problems.push(`${CATALOG_LABEL} lists the drinks in a different order than drinks.json`);
  }

  const siteById = new Map();
  for (const drink of siteDrinks) {
    if (isPlainObject(drink) && !siteById.has(drink.id)) siteById.set(drink.id, drink);
  }
  for (const rootDrink of rootDrinks) {
    const siteDrink = isPlainObject(rootDrink) ? siteById.get(rootDrink.id) : undefined;
    if (!siteDrink) continue;
    const rootRest = withoutImageFields(rootDrink);
    const siteRest = withoutImageFields(siteDrink);
    const fields = [...new Set([...Object.keys(rootRest), ...Object.keys(siteRest)])];
    const changed = fields.filter((field) => !isDeepStrictEqual(rootRest[field], siteRest[field]));
    if (changed.length > 0) {
      problems.push(`${rootDrink.id}: non-image field(s) ${changed.join(', ')} differ from drinks.json`);
    }
    if (variantKeys(rootDrink) !== variantKeys(siteDrink)) {
      problems.push(
        `${rootDrink.id}: imageVariants keys [${variantKeys(siteDrink)}] differ from drinks.json [${variantKeys(rootDrink)}]`,
      );
    }
  }
  return problems;
}

function budgetStatus(width, bytes) {
  if (!Object.prototype.hasOwnProperty.call(BUDGETS, width)) throw new RangeError(`no size budget for width ${width}`);
  if (bytes > BUDGETS[width].fail) return 'fail';
  if (bytes > BUDGETS[width].warn) return 'warn';
  return 'ok';
}

// Reads the canvas size from a WebP file header ("VP8 ", "VP8L" or "VP8X"); null when it is not a WebP.
function readWebpSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < WEBP_HEADER_BYTES) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  return null;
}

// Reads width and height from a PNG's IHDR chunk; null when the bytes are not a PNG.
function readPngSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_HEADER_BYTES) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE) || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

function formatKB(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function formatMB(bytes) {
  return `${(bytes / MB).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// File system
// ---------------------------------------------------------------------------

function siteFile(rootDir, sitePath) {
  return path.join(rootDir, SITE_DIR, ...sitePath.split('/'));
}

function isInside(rootDir, file) {
  const relative = path.relative(rootDir, file);
  return relative !== '' && relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative);
}

function readJsonFile(file, label, errors) {
  if (!fs.existsSync(file)) {
    errors.push(`${label} is missing`);
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

// Hashes every source image (no sharp needed) and derives the published path of each variant.
function planSite(rootDir) {
  const errors = [];
  const plans = [];
  const rootDrinks = readJsonFile(path.join(rootDir, 'drinks.json'), 'drinks.json', errors);
  if (rootDrinks !== undefined && !Array.isArray(rootDrinks)) errors.push('drinks.json must contain an array of drinks');
  if (Array.isArray(rootDrinks)) {
    const seen = new Set();
    rootDrinks.forEach((drink, index) => {
      const id = isPlainObject(drink) ? drink.id : undefined;
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
        errors.push(`drinks.json[${index}]: id ${JSON.stringify(id)} must be lowercase snake_case`);
        return;
      }
      if (seen.has(id)) {
        errors.push(`${id}: duplicate id in drinks.json`);
        return;
      }
      seen.add(id);
      if (typeof drink.imagePath !== 'string' || drink.imagePath === '') {
        errors.push(`${id}: imagePath must be a non-empty string`);
        return;
      }
      const sourceFile = path.resolve(rootDir, drink.imagePath);
      if (!isInside(rootDir, sourceFile)) {
        errors.push(`${id}: imagePath ${drink.imagePath} points outside the repository`);
        return;
      }
      if (!fs.existsSync(sourceFile)) {
        errors.push(`${id}: source image ${drink.imagePath} not found`);
        return;
      }
      const sourceBytes = fs.readFileSync(sourceFile);
      const paths = {};
      for (const width of WIDTHS) paths[width] = variantSitePath(id, width, variantHash(sourceBytes, width));
      try {
        plans.push({ id, source: drink.imagePath, sourceFile, paths, siteDrink: rewriteImageFields(drink, paths) });
      } catch (error) {
        errors.push(`${id}: ${error.message}`);
      }
    });
  }
  return {
    errors,
    plans,
    rootDrinks: Array.isArray(rootDrinks) ? rootDrinks : null,
    siteDrinks: errors.length === 0 ? plans.map((plan) => plan.siteDrink) : null,
  };
}

function readFileHead(file, length) {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    return buffer.subarray(0, fs.readSync(fd, buffer, 0, length, 0));
  } finally {
    fs.closeSync(fd);
  }
}

function writeFileAtomic(file, data) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

// Append-only: an existing output is never replaced.
function writeNewFile(file, data) {
  if (fs.existsSync(file)) return false;
  writeFileAtomic(file, data);
  return true;
}

function removeTempFiles(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.tmp')) fs.rmSync(path.join(dir, name), { force: true });
  }
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) total += directorySize(entryPath);
    else if (entry.isFile()) total += fs.statSync(entryPath).size;
  }
  return total;
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  let failed = false;
  const lane = async () => {
    while (!failed && next < items.length) {
      const item = items[next];
      next += 1;
      try {
        await worker(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane));
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

// sharp is loaded here only, so --check and the tests run without it.
function createSharpEncoder() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    throw new Error(`sharp is needed to encode images; run npm ci first (${error.message})`);
  }
  return (sourceBytes, width) =>
    sharp(sourceBytes)
      .flatten()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toBuffer();
}

// Outputs are permanent, so anything that would fail the check is rejected before it is written.
function assertEncodedOutput(job, output) {
  const size = Buffer.isBuffer(output) ? readWebpSize(output) : null;
  if (!size) throw new Error(`${job.id}: the encoder did not return a WebP image for ${job.sitePath}`);
  if (size.width !== job.width || size.height !== job.width) {
    throw new Error(
      `${job.id}: ${job.sitePath} would be ${size.width}x${size.height} px; expected exactly ${job.width}x${job.width} px`,
    );
  }
  if (budgetStatus(job.width, output.length) === 'fail') {
    throw new Error(
      `${job.id}: ${job.sitePath} would be ${formatKB(output.length)}, over the ${job.width} budget of ${formatKB(BUDGETS[job.width].fail)}`,
    );
  }
}

async function buildSite(rootDir, { encode, concurrency = 4, log = console.log } = {}) {
  if (typeof encode !== 'function') throw new TypeError('buildSite needs an encode(sourceBytes, width) function');
  const plan = planSite(rootDir);
  if (plan.errors.length > 0) throw new Error(`cannot build the site:\n  - ${plan.errors.join('\n  - ')}`);

  const imageDir = path.join(rootDir, SITE_DIR, ...IMAGE_DIR.split('/'));
  fs.mkdirSync(imageDir, { recursive: true });
  removeTempFiles(imageDir);

  let kept = 0;
  const jobs = [];
  for (const drinkPlan of plan.plans) {
    for (const width of WIDTHS) {
      const sitePath = drinkPlan.paths[width];
      if (fs.existsSync(siteFile(rootDir, sitePath))) kept += 1;
      else jobs.push({ ...drinkPlan, width, sitePath });
    }
  }

  // Refuse before encoding anything: a source smaller than a variant would be upscaled or published too small.
  const sourceProblems = new Set();
  for (const job of jobs) {
    const size = readPngSize(readFileHead(job.sourceFile, PNG_HEADER_BYTES));
    if (!size) {
      sourceProblems.add(`${job.id}: ${job.source} is not a PNG file (build:site reads the source size from its PNG header)`);
    } else if (size.width < job.width || size.height < job.width) {
      sourceProblems.add(
        `${job.id}: ${job.source} is ${size.width}x${size.height} px, smaller than the ${job.width} px variant; ` +
          'build:site will not upscale it or publish a smaller image (replace placeholders with full-size cards)',
      );
    }
  }
  if (sourceProblems.size > 0) throw new Error(`cannot build the site:\n  - ${[...sourceProblems].join('\n  - ')}`);

  let encoded = 0;
  await runPool(jobs, concurrency, async (job) => {
    const sourceBytes = fs.readFileSync(job.sourceFile);
    if (variantSitePath(job.id, job.width, variantHash(sourceBytes, job.width)) !== job.sitePath) {
      throw new Error(`${job.id}: ${job.source} changed during the build; run it again`);
    }
    const output = await encode(sourceBytes, job.width);
    assertEncodedOutput(job, output);
    if (writeNewFile(siteFile(rootDir, job.sitePath), output)) encoded += 1;
    else kept += 1;
    log(`  + ${SITE_DIR}/${job.sitePath} (${formatKB(output.length)})`);
  });

  const catalogText = renderCatalog(plan.siteDrinks);
  const catalogPath = path.join(rootDir, SITE_DIR, ...CATALOG_FILE.split('/'));
  const current = fs.existsSync(catalogPath) ? normalizeLineEndings(fs.readFileSync(catalogPath, 'utf8')) : null;
  const catalogChanged = current !== catalogText;
  if (catalogChanged) {
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
    writeFileAtomic(catalogPath, catalogText);
  }
  return { drinks: plan.plans.length, encoded, kept, catalogChanged };
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

function imageRefs(drink, errors) {
  const refs = [{ field: 'imagePath', value: drink.imagePath, width: IMAGE_PATH_WIDTH }];
  if (!isPlainObject(drink.imageVariants)) {
    errors.push(`${drink.id}: imageVariants must be an object`);
    return refs;
  }
  for (const [key, value] of Object.entries(drink.imageVariants)) {
    if (!VARIANT_KEY_WIDTHS.has(key)) {
      errors.push(`${drink.id}: unsupported imageVariants key "${key}"`);
      continue;
    }
    refs.push({ field: `imageVariants["${key}"]`, value, width: VARIANT_KEY_WIDTHS.get(key) });
  }
  return refs;
}

function checkImageRef(drink, ref, drinkPlan, errors, referenced) {
  const where = `${drink.id}: ${ref.field}`;
  const parsed = parseVariantPath(ref.value);
  if (!parsed) {
    errors.push(`${where} is ${JSON.stringify(ref.value)}; expected ${PATH_PATTERN_TEXT}`);
    return;
  }
  if (parsed.id !== drink.id) {
    errors.push(`${where} points at another drink's file (${ref.value})`);
    return;
  }
  if (parsed.width !== ref.width) {
    errors.push(`${where} must point at the ${ref.width} variant, not ${ref.value}`);
    return;
  }
  if (drinkPlan && drinkPlan.paths[ref.width] !== ref.value) {
    errors.push(
      `${where} is ${ref.value} but ${drinkPlan.source} now produces ${drinkPlan.paths[ref.width]}; run npm run build:site`,
    );
  }
  const entry = referenced.get(ref.value) || { width: ref.width, owners: [] };
  entry.owners.push(where);
  referenced.set(ref.value, entry);
}

// Every published output must be a WebP of exactly <width>x<width> px, read from its header (no decoding).
function webpSizeProblem(size, width) {
  if (!size) return 'is not a WebP file';
  if (size.width !== width || size.height !== width) {
    return `is ${size.width}x${size.height} px; the ${width} variant must be exactly ${width}x${width} px`;
  }
  return null;
}

function emptyVariantStats() {
  return { count: 0, totalBytes: 0, minBytes: 0, maxBytes: 0, maxPath: null };
}

function addVariantStat(stat, sitePath, bytes) {
  stat.minBytes = stat.count === 0 ? bytes : Math.min(stat.minBytes, bytes);
  stat.count += 1;
  stat.totalBytes += bytes;
  if (bytes > stat.maxBytes) {
    stat.maxBytes = bytes;
    stat.maxPath = sitePath;
  }
}

function checkSite(rootDir, { siteTotalLimit = SITE_TOTAL_LIMIT } = {}) {
  const errors = [];
  const warnings = [];
  const siteDir = path.join(rootDir, SITE_DIR);

  for (const [name, reason] of Object.entries(REQUIRED_SITE_FILES)) {
    if (!fs.existsSync(path.join(siteDir, name))) errors.push(`${SITE_DIR}/${name} is missing (${reason})`);
  }

  const plan = planSite(rootDir);
  errors.push(...plan.errors);
  const planById = new Map(plan.plans.map((drinkPlan) => [drinkPlan.id, drinkPlan]));

  const catalogPath = path.join(siteDir, ...CATALOG_FILE.split('/'));
  let catalogText = null;
  let siteDrinks;
  if (!fs.existsSync(catalogPath)) {
    errors.push(`${CATALOG_LABEL} is missing; run npm run build:site`);
  } else {
    catalogText = normalizeLineEndings(fs.readFileSync(catalogPath, 'utf8'));
    try {
      siteDrinks = JSON.parse(catalogText);
    } catch (error) {
      errors.push(`${CATALOG_LABEL} is not valid JSON (${error.message}); run npm run build:site`);
    }
  }

  const stats = {
    drinks: Array.isArray(siteDrinks) ? siteDrinks.length : 0,
    catalogBytes: catalogText === null ? 0 : fs.statSync(catalogPath).size,
    variants: { 512: emptyVariantStats(), 1024: emptyVariantStats() },
    imageFiles: 0,
    unreferenced: 0,
    siteBytes: 0,
    siteTotalLimit,
  };

  // Every image field: naming pattern, own drink, right variant, fresh hash.
  const referenced = new Map();
  if (siteDrinks !== undefined) {
    if (plan.rootDrinks) errors.push(...findCatalogDrift(plan.rootDrinks, siteDrinks));
    else if (!Array.isArray(siteDrinks)) errors.push(`${CATALOG_LABEL} must contain an array of drinks`);
    if (Array.isArray(siteDrinks)) {
      for (const drink of siteDrinks.filter(isPlainObject)) {
        for (const ref of imageRefs(drink, errors)) checkImageRef(drink, ref, planById.get(drink.id), errors, referenced);
      }
    }
  }

  // Every referenced file: exists, is a WebP of exactly <width>x<width> px (header only), and fits the budget.
  for (const [sitePath, { width, owners }] of referenced) {
    const label = `${SITE_DIR}/${sitePath}`;
    const file = siteFile(rootDir, sitePath);
    if (!fs.existsSync(file)) {
      errors.push(`${label} is missing (referenced by ${owners.join(', ')}); run npm run build:site`);
      continue;
    }
    const bytes = fs.readFileSync(file);
    const size = readWebpSize(bytes);
    const sizeProblem = webpSizeProblem(size, width);
    if (sizeProblem) errors.push(`${label} ${sizeProblem}`);
    if (!size) continue;
    const status = budgetStatus(width, bytes.length);
    if (status === 'fail') {
      errors.push(`${label} is ${formatKB(bytes.length)} (${bytes.length} B), over the ${width} limit of ${BUDGETS[width].fail / KB} KB`);
    } else if (status === 'warn') {
      warnings.push(
        `${label} is ${formatKB(bytes.length)} (${bytes.length} B), above the ${width} warning level of ${BUDGETS[width].warn / KB} KB`,
      );
    }
    addVariantStat(stats.variants[width], sitePath, bytes.length);
  }

  // Only build outputs live in img/v1. Outputs of earlier builds stay (append-only) and are counted; their
  // header is re-checked too (WebP, exact size), but not their budget, which is a policy for new outputs.
  const imageDir = path.join(siteDir, ...IMAGE_DIR.split('/'));
  if (fs.existsSync(imageDir)) {
    for (const entry of fs.readdirSync(imageDir, { withFileTypes: true })) {
      const match = entry.isFile() ? FILE_NAME_PATTERN.exec(entry.name) : null;
      if (!match) {
        errors.push(`unexpected ${entry.isFile() ? 'file' : 'entry'} ${SITE_DIR}/${IMAGE_DIR}/${entry.name}: only build:site outputs belong there`);
        continue;
      }
      stats.imageFiles += 1;
      if (referenced.has(`${IMAGE_DIR}/${entry.name}`)) continue;
      stats.unreferenced += 1;
      const head = readFileHead(path.join(imageDir, entry.name), WEBP_HEADER_BYTES);
      const sizeProblem = webpSizeProblem(readWebpSize(head), Number(match[2]));
      if (sizeProblem) errors.push(`${SITE_DIR}/${IMAGE_DIR}/${entry.name} ${sizeProblem}`);
    }
  }

  if (plan.siteDrinks && catalogText !== null && catalogText !== renderCatalog(plan.siteDrinks)) {
    errors.push(`${CATALOG_LABEL} differs from what build:site generates (stale or hand-edited); run npm run build:site`);
  }

  stats.siteBytes = directorySize(siteDir);
  if (stats.siteBytes > siteTotalLimit) {
    errors.push(`${SITE_DIR}/ total is ${formatMB(stats.siteBytes)} (${stats.siteBytes} B), over the ${formatMB(siteTotalLimit)} limit`);
  }

  return { errors, warnings, stats };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printCheckResult({ errors, warnings, stats }) {
  console.log(`🔎 Site check (${SITE_DIR}/, offline)`);
  console.log(`  ${CATALOG_LABEL}: ${stats.drinks} drinks, ${formatKB(stats.catalogBytes)}`);
  for (const width of WIDTHS) {
    const variant = stats.variants[width];
    const average = variant.count > 0 ? variant.totalBytes / variant.count : 0;
    const largest = variant.maxPath ? ` (${path.posix.basename(variant.maxPath)})` : '';
    console.log(
      `  ${width} images: ${variant.count} referenced, min ${formatKB(variant.minBytes)}, avg ${formatKB(average)}, ` +
        `max ${formatKB(variant.maxBytes)}${largest}, total ${formatMB(variant.totalBytes)}`,
    );
  }
  console.log(`  ${SITE_DIR}/${IMAGE_DIR}/: ${stats.imageFiles} files, ${stats.unreferenced} kept from earlier builds`);
  console.log(`  ${SITE_DIR}/ total: ${formatMB(stats.siteBytes)} (budget ${formatMB(stats.siteTotalLimit)})`);
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`);
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  if (errors.length > 0) {
    console.error(`\n❌ Site check failed with ${errors.length} error(s):`);
    errors.forEach((error, index) => console.error(`  ${index + 1}. ${error}`));
  } else {
    console.log('\n✅ Site check passed');
  }
}

async function main(argv = process.argv.slice(2), rootDir = REPO_ROOT) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const unknown = argv.filter((arg) => arg !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(' ')}\n${USAGE}`);
    return 2;
  }
  if (!argv.includes('--check')) {
    console.log(`🍹 Building the GitHub Pages site under ${SITE_DIR}/ ...`);
    const summary = await buildSite(rootDir, { encode: createSharpEncoder() });
    console.log(
      `Encoded ${summary.encoded} new WebP file(s), kept ${summary.kept} existing; ` +
        `${CATALOG_LABEL} ${summary.catalogChanged ? 'updated' : 'unchanged'}.\n`,
    );
  }
  const result = checkSite(rootDir);
  printCheckResult(result);
  return result.errors.length > 0 ? 1 : 0;
}

module.exports = {
  BUDGETS,
  SITE_TOTAL_LIMIT,
  WIDTHS,
  budgetStatus,
  buildSite,
  checkSite,
  encodingParams,
  findCatalogDrift,
  main,
  parseVariantPath,
  readPngSize,
  readWebpSize,
  renderCatalog,
  rewriteImageFields,
  variantFileName,
  variantHash,
  variantSitePath,
};

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`❌ ${error.message}`);
      process.exitCode = 1;
    },
  );
}
