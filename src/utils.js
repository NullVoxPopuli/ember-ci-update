import fs from 'fs/promises';
import path from 'path';

``;

export const topLevelKeys = ['provider', 'template', 'defaultBranch', 'packageManager'];

/**
 * @param {string} parentDir
 */
export async function dirs(parentDir) {
  let isDirectory = (await fs.stat(parentDir)).isDirectory();

  if (!isDirectory) return [];

  let dir = await fs.readdir(parentDir);

  let results = [];

  for (let entry of dir) {
    let stat = await fs.stat(path.join(parentDir, entry));

    if (stat.isDirectory()) {
      results.push(entry);
    }
  }

  return results;
}
