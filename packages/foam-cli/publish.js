#!/usr/bin/env node
const fs = require('fs');

const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const originalName = pkg.name;
const originalDependencies = { ...pkg.dependencies };

// The CLI bundle is fully self-contained (esbuild bundles all deps),
// so workspace-only packages like @foam/core must be stripped before publishing
// (they aren't on the public registry). Real npm packages like micromatch are
// kept so npm knows what the bundle contains.
pkg.name = 'foam-cli';
delete pkg.dependencies['@foam/core'];
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const { execSync } = require('child_process');
try {
  execSync('npm publish --registry https://registry.npmjs.org/', { stdio: 'inherit' });
} finally {
  pkg.name = originalName;
  pkg.dependencies = originalDependencies;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
