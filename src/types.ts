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
  fixes?: string[];
  build: { run: string; expect: string },
  support?: {
    glint?: boolean;
    typescript?: boolean | Array<`typescript@{number}.{number}`>;
    'ember-try'?: boolean | Array<string>;
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
