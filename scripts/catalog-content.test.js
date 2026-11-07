/*
  Content guard for the real catalog (root drinks.json and the generated docs/v1/drinks.json).
  Uses Node's built-in test runner, no extra dependencies. Run: npm test
  Display names and aliases must stay free of strongly explicit words: the app shows aliases on screen ("Also known as: ..."),
  so the explicit original name of a drink cannot be kept as an alias.
*/
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

// Strongly explicit words that must not appear in a drink's display name or aliases.
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
    it(`${file}: no drink name or alias contains a strongly explicit word`, () => {
      const offenders = drinks.flatMap((drink) =>
        [drink.name, ...(drink.aliases ?? [])].filter((text) => EXPLICIT_NAME_PATTERN.test(text)).map((text) => `${drink.id}: ${text}`),
      );
      assert.deepEqual(offenders, []);
    });

    it(`${file}: shows "Adios MF" with only the clean AMF alias and a stable id`, () => {
      const matches = drinks.filter((drink) => drink.id === 'adios_motherfucker');
      assert.equal(matches.length, 1);
      const [drink] = matches;
      assert.equal(drink.name, 'Adios MF');
      assert.deepEqual(drink.aliases, ['AMF']);
    });
  }
});
