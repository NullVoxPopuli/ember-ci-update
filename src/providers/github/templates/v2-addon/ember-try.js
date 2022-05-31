import path from 'path';

/**
 * @typedef {import('types').GitHubV2AddonConfig} Config
 *
 * @param {import('types').GitHubV2AddonConfig} config;
 * @param {import('types').Options} options
 */
export async function getEmberTryNames(config, options) {
  let { testApp } = config;

  let testAppPath = path.join(options.cwd, testApp);

  let emberTryPath = path.join(testAppPath, 'config', 'ember-try.js');

  let module = await import(emberTryPath);
  let emberTry = await module.default();

  let scenarios = emberTry.scenarios.map((scenario) => scenario.name);

  return scenarios;
}
