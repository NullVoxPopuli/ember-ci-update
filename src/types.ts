export interface Options {
  cwd: string;
}

export interface Config {
  provider: 'github';
  template: 'string';

  defaultBranch: 'string';
  packageManager: 'pnpm';
}

export type GitHubConfig = Config & {
  template: 'v2-addon'
}

export type GitHubV2AddonConfig = GitHubConfig & {
  build: { run: string; expect: string },
  support?: {
    typescript?: Array<`typescript@{number}.{number}`>;
    'ember-try'?: Array<string>;
  },
  lint?: {
    commits?: boolean;
    eslint?: string[];
  }
  release?: {
    semantic?: boolean;
  },
  extra?: Array<{
    name: string
    needs?: string;
    steps: unknown[];
  }>
}
