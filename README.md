# ember-ci-update

CLI to generate robust CI configs for ember projects

## Setup

- Must have Node 16+
- pnpm only.
  yarn and npm are not supported.

## Usage

Create an `ci.yml` in the root of your repo.

When it's time to update the config, run `npx ember-ci-update` and commit the changes.

This tool generates real CI configs that can then be edited as you're used to for further customizations.


### Minimal Config

For ember v2 addons using JavaScript only, with no automated release

```yaml
provider: github
template: "v2-addon"

# ---------------------

addon: './ember-velcro'
testApp: './test-app'

lint:
  cmd: 'pnpm lint'

build:
  run: 'pnpm build'
  expect: |
    components/velcro/index.js
    modifiers/velcro.js

support:
  ember-try: true
```

## All config options and their defaults

```yml
# Optional -- default: 'github' (also the only supported CI provider at the moment)
provider: 'github'

# Optional -- default: 'main'
defaultBranch: main

# Optional -- default: 'pnpm' (also the only supported pcakage manager)
packageManager: pnpm

# Optional -- default: 'v2-addon' (also the only supported template at the moment)
template: 'v2-addon'

# In the future, depending on the chosen template, the followign options may vary.
# But for now, since the only supported combination is github + v2-addon:


# the path to the addon directory
addonPath: './ember-resources'
# the path to the test app
testApp: './testing/ember-app'

lint:
  commits: true
  cmd: pnpm lint
  # or optionally specific paths:
  eslint:
    - "./ember-resources"
    - "./testing/ember-app"

# v2 addons need to be built. This config tells the CI config what command
# to build your package and will fail if the listed file/folder paths are not present
build:
  run: 'pnpm run build:js'
  expect: |
    core
    util
    index.js
    index.js.map
    index.d.ts
    index.d.ts.map

# All of this is optional, but highly recommended to test against and declare support for
# various typescript and ember-try scenarios
support:
  typescript:
   - typescript@4.2
   - typescript@4.3
   - typescript@4.4
   - typescript@4.5
   - typescript@4.6
   - typescript@4.7

  # optionally use the glint bin instead of tsc
  glint: true

  # reads the config/ember-try.js config file
  ember-try: true

# Optional, default is to not use semantic-release
release:
  semantic: true

# Any additional build steps can use the same syntax / notation
# as the actual C.I. provider.
# Note though that the setup and environment are omitted here, because
# ember-ci-update handles the generation of all that.
extra:
  - name: Measure Asset Sizes
    needs: ['build']
    steps:
      # ember-ci-update inserts preamble here
      - name: 'measure asset sizes'
        run: node ./build/estimate-bytes/index.js
      - name: comment on PR
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          path: ./build/estimate-bytes/comment.txt
```
