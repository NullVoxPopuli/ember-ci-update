import assert from 'assert';

import { topLevelKeys as genericTopLevelKeys } from './utils.js';

const topLevelKeys = [
  'build',
  'lint',
  'support',
  'release',
  'extra',
  'addon',
  'testApp',
  ...genericTopLevelKeys,
];
const supportKeys = ['glint', 'typescript', 'ember-try'];
const releaseKeys = ['semantic'];
const buildKeys = ['run', 'expect'];

const supportedPackageManagers = ['pnpm'];

/**
 *
 * @param {import('types').GitHubConfig | import('types').GitHubV2AddonConfig} config
 * @return {import('types').GitHubV2AddonConfig}
 */
export function verifyConfig(config) {
  for (let key of Object.keys(config)) {
    assert(
      topLevelKeys.includes(key),
      `${key} was not a recognized top-level key in ci.yml. Possible keys are ${topLevelKeys.join(
        ', '
      )}`
    );
  }

  assert(
    'build' in config,
    `Expected to find 'build' as a top-level configuration object in ci.yml`
  );

  assert(
    !config.packageManager || supportedPackageManagers.includes(config.packageManager),
    `Specified packageManager, ${
      config.packageManager
    }, is not supported. Supported packageManager(s): ${supportedPackageManagers.join(', ')}`
  );

  assert(
    'addon' in config && typeof config.addon === 'string',
    `Expected addon to be specified as a string, representing the path to the addon path`
  );

  assert(
    'testApp' in config && typeof config.testApp === 'string',
    `Expected testApp to be specified as a string, representing the path to the test app.`
  );

  for (let key of Object.keys(config.build)) {
    assert(
      buildKeys.includes(key),
      `${key} was not a recognized build key in ci.yml. Possible keys are ${buildKeys.join(', ')}`
    );
  }

  for (let key of Object.keys(config.support || {})) {
    assert(
      supportKeys.includes(key),
      `${key} was not a recognized support key in ci.yml. Possible keys are ${supportKeys.join(
        ', '
      )}`
    );
  }

  for (let key of Object.keys(config.release || {})) {
    assert(
      releaseKeys.includes(key),
      `${key} was not a recognized release key in ci.yml. Possible keys are ${releaseKeys.join(
        ', '
      )}`
    );
  }

  return config;
}
