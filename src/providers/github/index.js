import assert from 'assert';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { dirs } from '../../utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {import('types').GitHubConfig} config
 * @param {import('types').Options} options
 */
export default async function github(config, options) {
  let templatesDir = path.join(__dirname, 'templates');
  let available = await dirs(templatesDir);

  let { template: requested } = config;

  assert(
    available.includes(requested),
    `Unsupported 'template', ${requested}. There are ${
      available.length
    } available template(s): ${available.join(', ')}`
  );

  let loadedModule = await import(`./templates/${requested}/index.js`);

  await loadedModule.default(config, options);
}
