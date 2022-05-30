import assert from 'assert';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { dirs } from '../utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {import('types').Config} config
 * @param {import('types').Options} options
 */
export async function forProvider(config, options) {
  let available = await dirs(__dirname);

  let { provider: requested } = config;

  assert(
    available.includes(requested),
    `Unsupported 'provider', ${requested}. There are ${
      available.length
    } available provider(s): ${available.join(', ')}`
  );

  let loadedModule = await import(`./${requested}/index.js`);

  await loadedModule.default(config, options);
}
