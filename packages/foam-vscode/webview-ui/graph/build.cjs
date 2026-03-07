const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const dir = __dirname;
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const libOnly = process.argv.includes('--lib');
const vscodeOnly = process.argv.includes('--vscode');
const buildLib = !vscodeOnly;
const buildVscode = !libOnly;

const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => console.log('[watch] build started'));
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

async function buildLibTarget() {
  console.log('Building lib (ESM)...');
  await esbuild.build({
    entryPoints: [
      path.join(dir, 'src/foam-graph.ts'),
      path.join(dir, 'src/protocol.ts'),
    ],
    bundle: true,
    format: 'esm',
    outdir: path.join(dir, 'dist'),
    platform: 'browser',
    external: ['lit', 'lit/*', 'lit/decorators.js'],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
  });
}

async function buildVscodeTarget() {
  const outdir = path.join(dir, '../../static/dataviz');

  // Ensure output directory exists
  fs.mkdirSync(outdir, { recursive: true });

  // Copy index.html
  fs.copyFileSync(path.join(dir, 'index.html'), path.join(outdir, 'index.html'));

  // Copy protocol.ts into the extension source so the extension can import it
  // without tsconfig path aliases (the file is gitignored as it is generated)
  const protocolSrc = fs.readFileSync(path.join(dir, 'src/protocol.ts'), 'utf8');
  const header =
    '// This file is auto-generated from webview-ui/graph/src/protocol.ts — do not edit directly.\n\n';
  fs.writeFileSync(
    path.join(dir, '../../src/features/panels/dataviz/graph-protocol.ts'),
    header + protocolSrc
  );

  const ctx = await esbuild.context({
    entryPoints: [
      path.join(dir, 'src/main.ts'),
      path.join(dir, 'src/main.css'),
    ],
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    outdir,
    entryNames: '[name]',
    platform: 'browser',
    format: 'iife',
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function main() {
  if (buildLib) await buildLibTarget();
  if (buildVscode) await buildVscodeTarget();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
