/*
  Content guard for the real catalog (root drinks.json and the generated docs/v1/drinks.json).
  Uses Node's built-in test runner, no extra dependencies. Run: npm test
  Display names must stay free of strongly explicit words; the full original name stays searchable via aliases.
*/
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

// Strongly explicit words that must not appear in a drink's display name.
const EXPLICIT_NAME_PATTERN = /fuck|shit|cunt|bitch|asshole|bastard|whore|slut|pussy|\bdick\b|\bcock\b/i;

function readCatalog(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

const CATALOGS = [
  ['drinks.json', readCatalog('drinks.json')],
  ['docs/v1/drinks.json', readCatalog('docs/v1/drinks.json')],
];

describe('catalog display names', () => {
  for (const [file, drinks] of CATALOGS) {
    it(`${file}: no drink name contains a strongly explicit word`, () => {
      const offenders = drinks.filter((drink) => EXPLICIT_NAME_PATTERN.test(drink.name)).map((drink) => `${drink.id}: ${drink.name}`);
      assert.deepEqual(offenders, []);
    });

    it(`${file}: shows "Adios MF" and keeps the full name searchable, with a stable id`, () => {
      const matches = drinks.filter((drink) => drink.id === 'adios_motherfucker');
      assert.equal(matches.length, 1);
      const [drink] = matches;
      assert.equal(drink.name, 'Adios MF');
      assert.ok(drink.aliases.includes('Adios Motherfucker'), 'aliases keep the full original name');
      assert.ok(drink.aliases.includes('AMF'), 'aliases keep the existing AMF alias');
      assert.equal(new Set(drink.aliases).size, drink.aliases.length, 'aliases have no duplicates');
    });
  }
});
