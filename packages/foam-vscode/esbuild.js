const { assert } = require('console');
const esbuild = require('esbuild');

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

const config = {
  web: {
    platform: 'browser',
    format: 'cjs',
    outfile: `out/bundles/extension-web.js`,
    plugins: [
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
  },
};

esbuild
  .build({
    ...config[platform],
    entryPoints: ['src/extension.ts'],
    bundle: true,
    external: ['vscode'],
    // define: {
    //   'process.env.NODE_ENV': '"production"',
    // },
  })
  .catch(e => {
    console.error('There was an issue while building', e);

    process.exit(1);
  });
