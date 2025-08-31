#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface DrinkEntry {
  id: string;
  name: string;
  category: string;
  popularity: number;
  imagePath: string;
  imageVariants: {
    [key: string]: string;
  };
}

interface ValidationResult {
  success: boolean;
  errors: string[];
}

function validateCatalog(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: []
  };

  const catalogPath = path.join(__dirname, '..', 'drinks.json');
  
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

    // Validate imagePath field
    if (!drink.imagePath || typeof drink.imagePath !== 'string') {
      result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imagePath must be a string`);
      result.success = false;
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

      // Validate each image variant path
      variantKeys.forEach(variantKey => {
        const variantPath = drink.imageVariants[variantKey];
        if (typeof variantPath !== 'string' || variantPath.trim() === '') {
          result.errors.push(`${drinkPrefix} (${drink.id || 'unknown id'}): imageVariants.${variantKey} must be a non-empty string`);
          result.success = false;
        }
      });
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

  return result;
}

function main(): void {
  console.log('🍹 Validating BarSignal catalog...\n');

  const result = validateCatalog();

  if (result.success) {
    console.log('✅ Catalog validation passed!');
    console.log(`📊 Validated ${JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'drinks.json'), 'utf-8')).length} drink entries`);
    process.exit(0);
  } else {
    console.log('❌ Catalog validation failed!\n');
    console.log('Errors found:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
    console.log(`\n💥 Found ${result.errors.length} error(s)`);
    process.exit(1);
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  main();
}

export { validateCatalog, DrinkEntry, ValidationResult };
