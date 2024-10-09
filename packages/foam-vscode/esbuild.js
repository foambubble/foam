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
  throw new Error('No platform specified. Pass --platform <web|node>.');
}

const platform = getPlatform();
assert(['web', 'node'].includes(platform), 'Platform must be "web" or "node".');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const config = {
  web: {
    platform: 'browser',
    format: 'cjs',
    outfile: `out/bundles/extension-web.js`,
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
    ],
  },
  node: {
    platform: 'node',
    format: 'cjs',
    outfile: `out/bundles/extension-node.js`,
    plugins: [],
  },
};

async function main() {
  const ctx = await esbuild.context({
    ...config[platform],
    entryPoints: ['src/extension.ts'],
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      ...config[platform].plugins,
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
