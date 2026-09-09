import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export function renderEnvironment(apiBaseUrl) {
  const normalizedUrl = apiBaseUrl.trim().replace(/\/+$/, '');
  let parsedUrl;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error('API_BASE_URL must be an absolute http(s) URL ending in /api/v1');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.pathname.endsWith('/api/v1')) {
    throw new Error('API_BASE_URL must be an absolute http(s) URL ending in /api/v1');
  }

  return `export const environment = {\n  apiBaseUrl: ${JSON.stringify(normalizedUrl)},\n};\n`;
}

export async function writeEnvironment(apiBaseUrl, outputPath = path.resolve('src/environments/environment.ts')) {
  await writeFile(outputPath, renderEnvironment(apiBaseUrl), 'utf8');
}

async function main() {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error('API_BASE_URL is required for a Railway build');
  }

  await writeEnvironment(apiBaseUrl);
}

const invokedPath = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
