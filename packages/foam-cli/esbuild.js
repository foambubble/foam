const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    // Prefer the ESM build of packages that ship both UMD and ESM (e.g. jsonc-parser).
    // esbuild defaults to 'main' for platform:node, which picks up UMD builds whose
    // internal relative requires are not statically traceable by esbuild.
    mainFields: ['module', 'main'],
    format: 'cjs',
    outfile: 'out/index.js',
    external: [],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }

  copyGraphBundle();
  copyAssets();
}

function copyGraphBundle() {
  const src = path.join(__dirname, '../foam-graph/out/foam-graph.standalone.js');
  const dest = path.join(__dirname, 'out/foam-graph.standalone.js');
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function copyAssets() {
  const src = path.join(__dirname, 'assets');
  const dest = path.join(__dirname, 'out/assets');
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
