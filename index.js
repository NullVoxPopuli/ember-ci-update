#!/usr/bin/env node
'use strict';

import path from 'path';

import fse from 'fs-extra';
import { parse } from 'yaml';

const CWD = process.cwd();

import { forProvider } from './src/providers/index.js';

async function main() {
  let config = await readConfig();

  await forProvider(config, { cwd: CWD });
}

/********************************************
 *
 * ***********************************/

const CONFIG_NAME = 'ci.yml';

/**
 * @return {Promise<import('src/types.js').Config>}
 */
async function readConfig() {
  let configPath = path.join(CWD, CONFIG_NAME);
  let buffer = await fse.readFile(configPath);
  let str = buffer.toString();

  let config = parse(str);

  return config;
}

main();
