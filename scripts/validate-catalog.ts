#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface DrinkEntry {
  id: string;
  name: string;
  category: string;
  popularity: number;
  aliases?: string[];
  imagePath: string;
  imageVariants: {
    [key: string]: string;
  };
  // allow boolean or array for flexibility
  modifiersSupported?: boolean | string[];
  ingredients?: Array<{ name: string; amount?: number; unit?: string; optional?: boolean }>;
  technique?: string;
  glass?: string;
  ice?: string | null;
  garnish?: Array<{ name: string; prep?: string }>;
  rim?: string | null;
  steps?: string[];
  totalVolumeMl?: number;
  estimatedAbvPercent?: number;
  calories?: number;
  strength?: string;
  difficulty?: string;
  prepTimeSec?: number;
  tags?: string[];
  origin?: { country?: string; city?: string | null; year?: number | null; creator?: string | null };
  sources?: string[];
  relatedDrinkIds?: string[];
  isIBAOfficial?: boolean;
  isMocktail?: boolean;
  themeColor?: string;
  accentColor?: string;
  dominantColors?: string[];
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings?: string[];
}

function validateCatalog(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: []
  };

  const catalogPath = path.join(__dirname, '..', 'drinks.json');
  const flagsPath = path.join(__dirname, '..', 'flags.json');
  
  // Check if drinks.json exists
  if (!fs.existsSync(catalogPath)) {
    result.errors.push('drinks.json file not found');
    result.success = false;
    return result;
  }

  let drinks: DrinkEntry[];
  
  // Load and parse drinks.json
  try {
    const catalogContent = fs.readFileSync(catalogPath, 'utf-8');
    drinks = JSON.parse(catalogContent);
  } catch (error) {
    result.errors.push(`Failed to parse drinks.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.success = false;
    return result;
  }

  // Validate array structure
  if (!Array.isArray(drinks)) {
    result.errors.push('drinks.json must contain an array of drink entries');
    result.success = false;
    return result;
  }

  const seenIds = new Set<string>();

  // Validate each drink entry
  drinks.forEach((drink, index) => {
    const drinkPrefix = `Drink at index ${index}`;

    // Check if drink is an object
    if (typeof drink !== 'object' || drink === null) {
      result.errors.push(`${drinkPrefix}: must be an object`);
      result.success = false;
      return;
    }

    // Validate id field
    if (!drink.id || typeof drink.id !== 'string' || drink.id.trim() === '') {
      result.errors.push(`${drinkPrefix}: id must be a non-empty string`);
      result.success = false;
    } else {
      // Check for duplicate ids
      if (seenIds.has(drink.id)) {
        result.errors.push(`${drinkPrefix}: duplicate id "${drink.id}"`);
        result.success = false;
      } else {
        seenIds.add(drink.id);
      }

      // Validate id format (snake_case)
      if (!/^[a-z0-9_]+$/.test(drink.id)) {
        result.errors.push(`${drinkPrefix}: id "${drink.id}" must be in snake_case format (lowercase letters, numbers, and underscores only)`);
        result.success = false;
      }
    }

    // Validate name field
    if (!drink.name || typeof drink.name !== 'string' || drink.name.trim() === '') {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): name must be a non-empty string`);
      result.success = false;
    }

    // Validate category field
    if (!drink.category || typeof drink.category !== 'string') {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): category must be a string`);
      result.success = false;
    }

    // Validate popularity field
    if (typeof drink.popularity !== 'number' || drink.popularity < 0 || drink.popularity > 100) {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): popularity must be a number between 0 and 100`);
      result.success = false;
    }

    // Validate aliases (optional)
    if (drink.aliases) {
      if (!Array.isArray(drink.aliases) || !drink.aliases.every(a => typeof a === 'string')) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): aliases must be an array of strings if provided`);
        result.success = false;
      }
    }

    // Validate imagePath field
    if (!drink.imagePath || typeof drink.imagePath !== 'string') {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imagePath must be a string`);
      result.success = false;
    } else {
      if (!drink.imagePath.startsWith('drinks/')) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imagePath must start with "drinks/"`);
        result.success = false;
      }
      if (!/\.(png)$/i.test(drink.imagePath)) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imagePath should be a .png file for consistency`);
      }
    }

    // Validate imageVariants field
    if (!drink.imageVariants || typeof drink.imageVariants !== 'object') {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imageVariants must be an object`);
      result.success = false;
    } else {
      // Check if imageVariants has any entries
      const variantKeys = Object.keys(drink.imageVariants);
      if (variantKeys.length === 0) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imageVariants must contain at least one variant`);
        result.success = false;
      }

      // Accept either sm/md or 512/1024 as keys, prefer sm/md
      const hasSmMd = variantKeys.includes('sm') && variantKeys.includes('md');
      const hasNumeric = variantKeys.includes('512') && variantKeys.includes('1024');
      if (!hasSmMd && !hasNumeric) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imageVariants should include keys {sm, md} (or {512, 1024} for legacy)`);
      }

      // Validate each image variant path and expected locations
      variantKeys.forEach(variantKey => {
        const variantPath = drink.imageVariants[variantKey];
        if (typeof variantPath !== 'string' || variantPath.trim() === '') {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imageVariants.${variantKey} must be a non-empty string`);
          result.success = false;
          return;
        }
        if (!variantPath.startsWith('drinks/_thumbs/')) {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imageVariants.${variantKey} must start with "drinks/_thumbs/"`);
          result.success = false;
        }
      });

      // If possible, check that variant file names match the base image basename with _512/_1024
      const base = path.basename(drink.imagePath, path.extname(drink.imagePath));
      const expected512 = `drinks/_thumbs/${base}_512.png`;
      const expected1024 = `drinks/_thumbs/${base}_1024.png`;
      const smPath = drink.imageVariants['sm'];
      const mdPath = drink.imageVariants['md'];
      const v512 = drink.imageVariants['512'];
      const v1024 = drink.imageVariants['1024'];
      const thumb = drink.imageVariants['thumb'];
      if (smPath && smPath !== expected512) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): sm path should be ${expected512}`);
      }
      if (mdPath && mdPath !== expected1024) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): md path should be ${expected1024}`);
      }
      if (v512 && v512 !== expected512) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): 512 path should be ${expected512}`);
      }
      if (v1024 && v1024 !== expected1024) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): 1024 path should be ${expected1024}`);
      }
      if (thumb && !thumb.startsWith('drinks/_thumbs/')) {
        result.warnings?.push(`${drinkPrefix} (${drink.id || 'unknown id'}): thumb should be under drinks/_thumbs/`);
      }
    }

    // Validate modifiersSupported (optional)
    if (typeof drink.modifiersSupported !== 'undefined') {
      const ms: any = drink.modifiersSupported;
      if (typeof ms !== 'boolean' && !(Array.isArray(ms) && ms.every((m: any) => typeof m === 'string'))) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): modifiersSupported must be boolean or an array of strings`);
        result.success = false;
      }
    }

    // Validate ingredients (optional)
    if (typeof drink.ingredients !== 'undefined') {
      if (!Array.isArray(drink.ingredients)) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ingredients must be an array`);
        result.success = false;
      } else {
        drink.ingredients.forEach((ing, ii) => {
          if (!ing || typeof ing.name !== 'string' || !ing.name.trim()) {
            result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ingredients[${ii}].name must be a non-empty string`);
            result.success = false;
          }
          if (typeof ing.amount !== 'undefined' && (typeof ing.amount !== 'number' || !isFinite(ing.amount) || ing.amount < 0)) {
            result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ingredients[${ii}].amount must be a non-negative number`);
            result.success = false;
          }
          if (typeof ing.unit !== 'undefined' && typeof ing.unit !== 'string') {
            result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ingredients[${ii}].unit must be a string`);
            result.success = false;
          }
          if (typeof ing.optional !== 'undefined' && typeof ing.optional !== 'boolean') {
            result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ingredients[${ii}].optional must be a boolean`);
            result.success = false;
          }
        });
      }
    }

    // Validate steps (optional)
    if (typeof drink.steps !== 'undefined') {
      if (!Array.isArray(drink.steps) || !drink.steps.every(s => typeof s === 'string' && s.trim())) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): steps must be an array of non-empty strings`);
        result.success = false;
      }
    }

    // Simple type checks for other optional fields
    const optString: Array<keyof DrinkEntry> = ['technique','glass','ice','rim','strength','difficulty','themeColor','accentColor'];
    optString.forEach(key => {
      const v: any = (drink as any)[key];
      if (typeof v !== 'undefined' && v !== null && typeof v !== 'string') {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ${String(key)} must be a string or null`);
        result.success = false;
      }
    });
    const optNumber: Array<keyof DrinkEntry> = ['totalVolumeMl','estimatedAbvPercent','calories','prepTimeSec'];
    optNumber.forEach(key => {
      const v: any = (drink as any)[key];
      if (typeof v !== 'undefined' && (typeof v !== 'number' || !isFinite(v) || v < 0)) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ${String(key)} must be a non-negative number`);
        result.success = false;
      }
    });
    if (typeof drink.tags !== 'undefined' && (!Array.isArray(drink.tags) || !drink.tags.every(t => typeof t === 'string'))) {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): tags must be an array of strings`);
      result.success = false;
    }
    if (typeof drink.origin !== 'undefined') {
      const o: any = drink.origin;
      if (typeof o !== 'object' || o === null) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): origin must be an object`);
        result.success = false;
      } else {
        if (typeof o.country !== 'undefined' && typeof o.country !== 'string') {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): origin.country must be a string`);
          result.success = false;
        }
        if (typeof o.city !== 'undefined' && o.city !== null && typeof o.city !== 'string') {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): origin.city must be a string or null`);
          result.success = false;
        }
        if (typeof o.year !== 'undefined' && o.year !== null && (typeof o.year !== 'number' || !Number.isInteger(o.year))) {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): origin.year must be an integer or null`);
          result.success = false;
        }
        if (typeof o.creator !== 'undefined' && o.creator !== null && typeof o.creator !== 'string') {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): origin.creator must be a string or null`);
          result.success = false;
        }
      }
    }
    if (typeof drink.sources !== 'undefined' && (!Array.isArray(drink.sources) || !drink.sources.every(s => typeof s === 'string'))) {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): sources must be an array of strings`);
      result.success = false;
    }
    if (typeof drink.relatedDrinkIds !== 'undefined' && (!Array.isArray(drink.relatedDrinkIds) || !drink.relatedDrinkIds.every(s => typeof s === 'string'))) {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): relatedDrinkIds must be an array of strings`);
      result.success = false;
    }
    const optBool: Array<keyof DrinkEntry> = ['isIBAOfficial','isMocktail'];
    optBool.forEach(key => {
      const v: any = (drink as any)[key];
      if (typeof v !== 'undefined' && typeof v !== 'boolean') {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): ${String(key)} must be a boolean`);
        result.success = false;
      }
    });
    if (typeof drink.garnish !== 'undefined') {
      if (!Array.isArray(drink.garnish)) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): garnish must be an array`);
        result.success = false;
      } else {
        drink.garnish.forEach((g, gi) => {
          if (!g || typeof g.name !== 'string' || !g.name.trim()) {
            result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): garnish[${gi}].name must be a non-empty string`);
            result.success = false;
          }
          if (typeof (g as any).prep !== 'undefined' && typeof (g as any).prep !== 'string') {
            result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): garnish[${gi}].prep must be a string`);
            result.success = false;
          }
        });
      }
    }
    if (typeof drink.dominantColors !== 'undefined') {
      if (!Array.isArray(drink.dominantColors) || !drink.dominantColors.every(c => typeof c === 'string')) {
        result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): dominantColors must be an array of strings`);
        result.success = false;
      }
    }
  });

  // Check for image files existence (optional - can be disabled if images don't exist yet)
  const checkImageFiles = process.env.VALIDATE_IMAGE_FILES === 'true';
  
  if (checkImageFiles) {
    drinks.forEach(drink => {
      if (!drink.id || !drink.imagePath) return;

      const mainImagePath = path.join(__dirname, '..', drink.imagePath);
      if (!fs.existsSync(mainImagePath)) {
        result.errors.push(`Image file not found: ${drink.imagePath} for drink "${drink.id}"`);
        result.success = false;
      }

      if (drink.imageVariants) {
        Object.entries(drink.imageVariants).forEach(([variant, imagePath]) => {
          const variantImagePath = path.join(__dirname, '..', imagePath);
          if (!fs.existsSync(variantImagePath)) {
            result.errors.push(`Image variant file not found: ${imagePath} (${variant}) for drink "${drink.id}"`);
            result.success = false;
          }
        });
      }
    });
  }

  // Optional: validate flags.json structure if present
  if (fs.existsSync(flagsPath)) {
    try {
      const flagsRaw = fs.readFileSync(flagsPath, 'utf-8');
      const flags = JSON.parse(flagsRaw) as Record<string, unknown>;
      if (typeof flags !== 'object' || flags === null) {
        result.errors.push('flags.json must be a JSON object');
        result.success = false;
      } else {
        if ('forceTextOnly' in flags && typeof (flags as any).forceTextOnly !== 'boolean') {
          result.errors.push('flags.json: forceTextOnly must be a boolean');
          result.success = false;
        }
        if ('catalogVersion' in flags && typeof (flags as any).catalogVersion !== 'string') {
          result.errors.push('flags.json: catalogVersion must be a string');
          result.success = false;
        }
      }
    } catch (e) {
      result.errors.push(`Failed to parse flags.json: ${e instanceof Error ? e.message : 'Unknown error'}`);
      result.success = false;
    }
  }

  return result;
}

function main(): void {
  console.log('🍹 Validating BarSignal catalog...\n');

  const result = validateCatalog();

  if (result.success) {
    console.log('✅ Catalog validation passed!');
    if (result.warnings && result.warnings.length) {
      console.log(`⚠️ ${result.warnings.length} warning(s):`);
      result.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    }
    console.log(`📊 Validated ${JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'drinks.json'), 'utf-8')).length} drink entries`);
    process.exit(0);
  } else {
    console.log('❌ Catalog validation failed!\n');
    console.log('Errors found:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
    if (result.warnings && result.warnings.length) {
      console.log('\nWarnings:');
      result.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    }
    console.log(`\n💥 Found ${result.errors.length} error(s)`);
    process.exit(1);
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  main();
}

export { validateCatalog, DrinkEntry, ValidationResult };
