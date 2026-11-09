import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');

test('Railway startup configuration serves the CRM production build', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  const launcher = fs.readFileSync(path.join(scriptsDirectory, 'start-railway.mjs'), 'utf8');

  assert.equal(packageJson.scripts['start:railway'], 'node scripts/start-railway.mjs');
  assert.match(launcher, /dist.*elevate-mk-crm.*browser/);
  assert.match(launcher, /process\.env\.PORT \|\| '8080'/);
  assert.match(launcher, /0\.0\.0\.0/);
  assert.match(launcher, /node_modules.*serve.*build.*main\.js/);
  assert.match(launcher, /'-s'/);
});
