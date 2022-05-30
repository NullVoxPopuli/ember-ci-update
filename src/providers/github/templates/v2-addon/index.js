import assert from 'assert';
import path from 'path';
import fse from 'fs-extra';
import { stripIndent } from 'common-tags';

import yaml from 'js-yaml';

import { verifyConfig } from './config.js';

const targetFile = '.github/workflows/ci.yml';

/**
 * @param {import('types').GitHubConfig} config
 * @param {import('types').Options} options
 */
export default async function v2Addon(config, options) {
  let _config = verifyConfig(config);

  let ci = await buildCi(_config, options);

  await write(ci, options);
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
 * TODO: determine what version "latest" is
 */
const actions = {
  pnpm: 'pnpm/action-setup@v2.2.2',
  cache: 'actions/cache@v3',
  checkout: 'actions/checkout@v3',
  downloadArtifact: 'actions/download-artifact@v3',
  uploadArtifact: 'actions/upload-artifact@v3',
  volta: 'volta-cli/action@v1',
  commitlint: 'wagoid/commitlint-github-action@v4.1.12',
};

let init = [{ uses: actions.checkout }, { uses: actions.volta }];

let depCache = [
  {
    name: 'Cache pnpm modules',
    uses: actions.cache,
    with: {
      path: '~/.pnpm-store',
      key: `\${{ runner.os }}-\${{ hashFiles('**/pnpm-lock.yaml') }}`,
      'restore-keys': '${{ runner.os }}-',
    },
  },
];

let pnpm = [
  {
    uses: actions.pnpm,
    with: {
      /**
       * TODO: detect pnpm version based on package.json
       *       information
       */
      version: '7.1.2',
    },
  },
];

let getDist = [
  {
    name: 'Download built package from cache',
    uses: actions.downloadArtifact,
    with: {
      name: 'dist',
      path: '${{ env.dist }}',
    },
  },
];

/**
 * @typedef {import('types').GitHubV2AddonConfig} Config
 *
 * @param {import('types').GitHubV2AddonConfig} config;
 * @param {import('types').Options} options
 */
async function buildCi(config, options) {
  let eslint = {};
  let typescript = {};
  let tryScenarios = {};
  let publish = {};
  let extras = {};

  let {
    defaultBranch = 'main',
    // packageManager = 'pnpm',
    addon,
    testApp,
    build,
    support,
    release,
    extra,
  } = config;

  let system = {
    'timeout-minutes': 5,
    'runs-on': 'ubuntu-latest',
  };

  let libraryName = await verifyAddon(config, options);
  let testAppName = await verifyTestApp(config, options, libraryName);

  let onlyPR = {
    if: `github.ref != 'refs/heads/${defaultBranch}'`,
  };

  let env = {
    CI: true,
    /**
     * TODO: detect what the dist is directory by reading the package.json?
     */
    dist: path.join(addon, 'dist'),
  };

  let install = [{ name: 'Install Dependencies', run: 'pnpm install' }];
  let installNoLockfile = [
    { name: 'Install Dependencies (without lockfile)', run: 'rm pnpm-lock.yaml && pnpm install' },
  ];

  if (config.lint?.eslint) {
    await verifyEslint(config, options);

    eslint = {
      eslint: {
        name: 'ESLint',
        needs: ['install_dependencies'],
        ...system,
        strategy: {
          'fail-fast': true,
          matrix: {
            path: [...config.lint.eslint],
          },
        },
        steps: [
          ...init,
          ...depCache,
          ...pnpm,
          ...install,
          {
            name: 'ESLint',
            run: 'cd ${{ matrix.path }} && pnpm run lint:js',
          },
        ],
      },
    };
  }

  if (config.support?.typescript) {
    assert(Array.isArray(config.support.typescript), 'expected support.typescript to be an array');

    typescript = {
      'typescript-compatibility': {
        name: '${{ matrix.typescript-scenario }}',
        ...system,
        'continue-on-error': true,
        needs: ['build'],
        strategy: {
          'fail-fast': true,
          matrix: {
            'typescript-scenario': config.support.typescript,
          },
        },
        steps: [
          ...init,
          ...depCache,
          ...pnpm,
          ...installNoLockfile,
          ...getDist,
          {
            name: 'Update TS Version',
            run: 'pnpm add --save-dev ${{ matrix.typescript-scenario }}',
            'working-directory': testApp,
          },
          {
            name: 'Type checking',
            run:
              `pnpm --filter ${testAppName} exec tsc -v;\n` +
              `pnpm --filter ${testAppName} exec tsc --build`,
          },
        ],
      },
    };
  }

  if (support?.['ember-try']) {
    tryScenarios = {
      'try-scenarios': {
        name: '${{ matrix.ember-try-scenario }}',
        ...system,
        'timeout-minutes': 10,
        needs: ['tests'],
        strategy: {
          'fail-fast': true,
          matrix: {
            'ember-try-scenario': config.support['ember-try'],
          },
        },
        steps: [
          ...init,
          ...depCache,
          ...pnpm,
          ...install,
          ...getDist,
          {
            name: 'test',
            'working-directory': testApp,
            run: `node_modules/.bin/ember try:one \${{ matrix.ember-try-scenario }} --skip-cleanup`,
          },
        ],
      },
    };
  }

  if (release?.semantic) {
    publish = {
      release: {
        name: 'Release',
        ...system,
        if: `github.ref == 'refs/heads/${defaultBranch}'`,
        needs: [
          'tests',
          ...(Object.keys(typescript).length ? ['typescript-compatibility'] : []),
          ...(Object.keys(tryScenarios).length ? ['try-scenarios'] : []),
          'floating-deps-tests',
        ],
        steps: [
          { uses: actions.checkout, with: { 'persist-credentials': false } },
          { uses: actions.volta },
          ...depCache,
          ...pnpm,
          ...install,
          ...getDist,
          {
            name: 'Release',
            run: './node_modules/.bin/semantic-release',
            'working-directory': addon,
            env: {
              NPM_TOKEN: '${{ secrets.NPM_TOKEN }}',
              GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
            },
          },
        ],
      },
    };
  }

  if (extra) {
    assert(Array.isArray(extra), 'Expected extra entry to be an array');

    for (let extraJob of extra) {
      let builtExtra = {
        ...extraJob,
        ...system,
        steps: [...init, ...depCache, ...pnpm, ...install, ...getDist, ...extraJob.steps],
      };

      let id =
        builtExtra.id ||
        (builtExtra.name ?? `extra_${extra.indexOf(extraJob)}`)
          .split('')
          .filter((char) => char.match(/\S/))
          .join('');

      extras[id] = builtExtra;
    }
  }

  let assertContents = yaml.dump({
    target: env.dist,
    setup: { run: build.run, cwd: addon },
    expect: build.expect,
  });

  let ci = {
    name: 'CI',
    on: {
      pull_request: null,
      push: {
        branches: [defaultBranch],
      },
      schedule: [
        // every Sunday at 3am
        { cron: '0 3 * * 0 ' },
      ],
    },

    env,

    jobs: {
      install_dependencies: {
        name: 'Install Dependencies',
        ...system,
        steps: [...init, ...depCache, ...pnpm, ...install],
      },
      ...eslint,
      ...(config.lint?.commits
        ? {
            commits: {
              name: 'Commit Messages',
              ...system,
              steps: [
                {
                  uses: actions.checkout,
                  with: { 'fetch-depth': 0 },
                },
                { uses: actions.volta },
                { uses: actions.commitlint },
              ],
            },
          }
        : {}),
      build: {
        name: 'Build Tests',
        needs: ['install_dependencies'],
        ...system,
        steps: [
          ...init,
          ...depCache,
          ...pnpm,
          ...install,
          {
            name: 'Build and Assert Output',
            run: stripIndent`
              echo '${assertContents}' >> assert-contents.config.yml
              npx assert-folder-contents
            `,
          },
          {
            uses: actions.uploadArtifact,
            with: { name: 'dist', path: '${{ env.dist }}' },
          },
        ],
      },

      tests: {
        name: 'Default Tests',
        ...system,
        needs: ['build'],
        steps: [
          ...init,
          ...depCache,
          ...pnpm,
          ...install,
          ...getDist,
          { run: `pnpm --filter ${testAppName} run test:ember` },
        ],
      },
      'floating-deps-tests': {
        name: 'Floating Deps Test',
        ...system,
        needs: ['build'],
        steps: [
          ...init,
          ...depCache,
          ...pnpm,
          ...installNoLockfile,
          ...getDist,
          { run: `pnpm --filter ${testAppName} run test:ember` },
        ],
      },
      ...tryScenarios,
      ...typescript,
      ...publish,
      ...extras,
    },
  };

  return ci;
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
