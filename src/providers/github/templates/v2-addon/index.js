import assert from 'node:assert';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import fse from 'fs-extra';
import klaw from 'klaw';
import yaml from 'js-yaml';
import ejs from 'ejs';

import { verifyConfig } from './config.js';
import { getEmberTryNames } from './ember-try.js';

const targetFile = '.github/workflows/ci.yml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateFiles = path.join(__dirname, 'files');

const stringify = (x) => `"${x}"`;
const toYamlArray = (array) => `[${array.map(stringify).join(', ')}]`;
const indent = (num) => {
  let result = '';

  for (let i = 0; i < num; i++) {
    result += '  ';
  }

  return result;
};
const toMultiLineArray = (array, indentCount) => {
  return array
    .map((item) => `- ${item}`)
    .map((line) => indent(indentCount) + line)
    .join('\n');
};
const eachLine = (str, callback) => {
  return str.split('\n').map(callback).join('\n');
};

/**
 * @param {import('types').GitHubConfig} config
 * @param {import('types').Options} options
 */
export default async function v2Addon(config, options) {
  await buildCi(verifyConfig(config), options);
}

/**
 * @param {object} ci
 * @param {import('types').Options} options
 */
async function write(ci, options) {
  let asString = await yaml.dump(ci, { noRefs: true, quotingType: `"` });

  // console.log({ asString });
  // let yml = stringify(ci, { directives: false, version: '1.2' });

  await fse.writeFile(path.join(options.cwd, targetFile), asString);
}

/**
 * @typedef {import('types').GitHubV2AddonConfig} Config
 *
 * @param {import('types').GitHubV2AddonConfig} config;
 * @param {import('types').Options} options
 */
async function buildCi(config, options) {
  let { defaultBranch = 'main', addon, support, release, extra } = config;

  let libraryName = await verifyAddon(config, options);
  let testAppName = await verifyTestApp(config, options, libraryName);

  let env = {
    CI: true,
    /**
     * TODO: detect what the dist is directory by reading the package.json?
     */
    dist: path.join(addon, 'dist'),
  };

  if (config.lint?.eslint) {
    await verifyEslint(config, options);
  }

  if (config.support?.typescript) {
    assert(Array.isArray(config.support.typescript), 'expected support.typescript to be an array');
  }

  if (support?.['ember-try']) {
    let scenarios = [];

    if (support['ember-try'] === true) {
      scenarios = await getEmberTryNames(config, options);
    }

    config.tryScenarios = scenarios;
  }

  if (release?.semantic) {
    /**
     * Names of jobs in ci.yml
     */
    config.releaseRequirements = [
      'default_tests',
      'floating_tests',
      ...(Object.keys(config.support?.typescript || {}).length ? ['typecheck'] : []),
      ...(config.support?.['ember-try'] ? ['try_scenarios'] : []),
    ];
  }

  config.extra = [];

  if (extra) {
    assert(Array.isArray(extra), 'Expected extra entry to be an array');

    for (let extraJob of extra) {
      config.extra.push({
        ...extraJob,
        id:
          extraJob.id ||
          (extraJob.name ?? `extra_${extra.indexOf(extraJob)}`)
            .split('')
            .filter((char) => char.match(/\S/))
            .join(''),
        steps: eachLine(yaml.dump(extraJob.steps), (line) => indent(3) + line),
      });
    }
  }

  for await (const file of klaw(templateFiles)) {
    if (file.stats.isDirectory()) continue;

    let relative = path.relative(templateFiles, file.path);
    let destination = path.join(options.cwd, '.github', relative.replace(/\.ejs$/, ''));
    let destinationDir = path.dirname(destination);

    await fse.mkdirp(destinationDir);

    console.info(`Processing ${relative}`);

    if (file.path.endsWith('.ejs')) {
      let templateContent = await fse.readFile(file.path);
      let content = ejs.render(templateContent.toString(), {
        ...config,
        env,
        defaultBranch,
        libraryName,
        testAppName,
        utils: {
          toArray: toYamlArray,
          toMultiLineArray,
          stringify,
          indent,
          eachLine,
        },
      });

      await fse.writeFile(destination, content);
      continue;
    }

    // Copy to destination
    await fse.copyFile(file.path, destination);
  }
}

/**
 * @param {import('types').GitHubV2AddonConfig} config;
 * @param {import('types').Options} options
 */
async function verifyAddon(config, options) {
  let addon = path.join(options.cwd, config.addon);
  let pJsonPath = path.join(addon, 'package.json');

  assert(await fse.pathExists(pJsonPath), `addon at ${addon} must have a package.json`);

  let pJson = await fse.readJSON(pJsonPath);

  return pJson.name;
}

/**
 * @param {import('types').GitHubV2AddonConfig} config;
 * @param {import('types').Options} options
 * @param {string} libraryName,
 */
async function verifyTestApp(config, options, libraryName) {
  let testAppPath = path.join(options.cwd, config.testApp);
  let pJsonPath = path.join(testAppPath, 'package.json');

  assert(await fse.pathExists(pJsonPath), `Test app at ${testAppPath} must have a package.json`);

  let pJson = await fse.readJSON(pJsonPath);

  assert(
    pJson.scripts['test:ember'],
    `The test app's package.json, does not have a test:ember script`
  );

  assert(pJson.dependencies[libraryName], `The test app must have a 'dependency' on the addon`);

  return pJson.name;
}

/**
 * @param {import('types').GitHubV2AddonConfig} config;
 * @param {import('types').Options} options
 */
async function verifyEslint(config, options) {
  let eslintConfig = config.lint.eslint;

  assert(Array.isArray(eslintConfig), `Expected eslint config to be an array of paths`);

  for (let entry of eslintConfig) {
    let pJsonPath = path.join(options.cwd, entry, 'package.json');

    assert(await fse.pathExists(pJsonPath), `Expected path, ${entry}, to have a package.json file`);

    let pJson = await fse.readJSON(pJsonPath);

    assert(
      pJson.scripts['lint:js'],
      `Expected the package.json at ${entry} to have a lint:js script`
    );
  }
}
