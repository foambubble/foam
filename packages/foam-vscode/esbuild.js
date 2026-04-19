// also see https://code.visualstudio.com/api/working-with-extensions/bundling-extension
const assert = require('assert');
const esbuild = require('esbuild');
const polyfillPlugin = require('esbuild-plugin-polyfill-node');

// pass the platform to esbuild as an argument

function getPlatform() {
  const args = process.argv.slice(2);
  const pArg = args.find(arg => arg.startsWith('--platform='));
  if (pArg) {
    return pArg.split('=')[1];
  }
  throw new Error('No platform specified. Pass --platform <web|node|webview>.');
}

function getEntry() {
  const args = process.argv.slice(2);
  const entryArg = args.find(arg => arg.startsWith('--entry='));
  return entryArg ? entryArg.split('=')[1] : 'extension';
}

const platform = getPlatform();
const entry = getEntry();
assert(
  ['web', 'node'].includes(platform),
  'Platform must be "web" or "node".'
);
assert(['extension', 'cli'].includes(entry), 'Entry must be "extension" or "cli".');
assert(
  !(entry === 'cli' && platform !== 'node'),
  'CLI entry must be built for the node platform.'
);

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const config = {
  extension: {
    web: {
      platform: 'browser',
      format: 'cjs',
      outfile: `out/bundles/extension-web.js`,
      define: {
        global: 'globalThis',
      },
      plugins: [
        polyfillPlugin.polyfillNode({
          // Options (optional)
        }),
        {
          name: 'path-browserify',
          setup(build) {
            build.onResolve({ filter: /^path$/ }, args => {
              return { path: require.resolve('path-browserify') };
            });
          },
        },
        {
          name: 'wikilink-embed',
          setup(build) {
            build.onResolve({ filter: /wikilink-embed/ }, args => {
              return {
                path: require.resolve(
                  args.resolveDir + '/wikilink-embed-web-extension.ts'
                ),
              };
            });
          },
        },
        {
          name: 'parse-entities-no-dom',
          setup(build) {
            // parse-entities maps ./decode-entity -> ./decode-entity.browser.js via
            // its package.json `browser` field when platform=browser. That version
            // uses document.createElement which is unavailable in VS Code Web
            // Extension host (Web Worker). Intercept the import before esbuild
            // applies the browser field remap and redirect to the Node.js version
            // that uses a pure lookup table instead.
            // Addresses #1566
            build.onResolve({ filter: /\/decode-entity$/ }, args => {
              if (args.resolveDir.includes('parse-entities')) {
                return {
                  path: require.resolve('parse-entities/decode-entity.js'),
                };
              }
            });
          },
        },
      ],
      entryPoints: ['src/extension.ts'],
      external: ['vscode'],
    },
    node: {
      platform: 'node',
      format: 'cjs',
      outfile: `out/bundles/extension-node.js`,
      plugins: [],
      entryPoints: ['src/extension.ts'],
      external: ['vscode'],
    },
  },
  cli: {
    platform: 'node',
    format: 'cjs',
    outfile: `out/cli/index.js`,
    plugins: [],
    entryPoints: ['src/cli/index.ts'],
    external: [],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
};

async function buildExtension() {
  const targetConfig =
    entry === 'extension' ? config.extension[platform] : config.cli;

  const ctx = await esbuild.context({
    ...targetConfig,
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: 'silent',
    plugins: [
      ...targetConfig.plugins,
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function main() {
  await buildExtension();
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log('[watch] build finished');
    });
  },
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
