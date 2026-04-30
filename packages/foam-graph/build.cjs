const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const esbuild = require('esbuild');

const dir = __dirname;
const packageOutDir = path.join(dir, 'out');
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
    outdir: packageOutDir,
    platform: 'browser',
    external: ['lit', 'lit/*', 'lit/decorators.js'],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
  });
  buildDeclarations();
  writeComponentEntrypointDeclaration();
}

function buildDeclarations() {
  childProcess.execFileSync(
    process.execPath,
    [
      require.resolve('typescript/lib/tsc'),
      '-p',
      path.join(dir, 'tsconfig.build.json'),
    ],
    { stdio: 'inherit' }
  );
}

function writeComponentEntrypointDeclaration() {
  // tsconfig.build.json intentionally emits declarations only for protocol.ts.
  // Full declaration emit for the Lit component currently exposes unrelated
  // internal graph typing issues, so keep the public component entrypoint as a
  // minimal side-effect import declaration.
  fs.writeFileSync(
    path.join(packageOutDir, 'foam-graph.d.ts'),
    [
      "declare global {",
      "  interface HTMLElementTagNameMap {",
      "    'foam-graph': HTMLElement;",
      "  }",
      "}",
      "export {};",
      "",
    ].join('\n')
  );
}

async function buildStandaloneTarget() {
  console.log('Building standalone (ESM, all deps bundled)...');
  await esbuild.build({
    entryPoints: [path.join(dir, 'src/foam-graph.ts')],
    bundle: true,
    format: 'esm',
    outfile: path.join(packageOutDir, 'foam-graph.standalone.js'),
    platform: 'browser',
    minify: true,
    sourcemap: false,
  });
}

async function buildVscodeTarget() {
  const outdir = path.join(dir, '../foam-vscode/static/dataviz');

  // Ensure output directory exists
  fs.mkdirSync(outdir, { recursive: true });

  // Copy index.html
  fs.copyFileSync(path.join(dir, 'index.html'), path.join(outdir, 'index.html'));

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
  if (buildLib) {
    await buildLibTarget();
    await buildStandaloneTarget();
  }
  if (buildVscode) await buildVscodeTarget();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
