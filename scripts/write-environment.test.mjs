import assert from 'node:assert/strict';
import test from 'node:test';

import { renderEnvironment } from './write-environment.mjs';

test('renders the configured API base URL without hardcoding an environment', () => {
  assert.equal(
    renderEnvironment('https://elevate-mk-api-staging.up.railway.app/api/v1/'),
    'export const environment = {\n  apiBaseUrl: "https://elevate-mk-api-staging.up.railway.app/api/v1",\n};\n',
  );
});

test('rejects a non-API or non-HTTP URL', () => {
  assert.throws(() => renderEnvironment('elevate-mk-api-staging.up.railway.app'), /absolute http\(s\) URL/);
  assert.throws(() => renderEnvironment('https://example.com'), /ending in \/api\/v1/);
});
