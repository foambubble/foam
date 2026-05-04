#!/usr/bin/env node
const fs = require('fs');

const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const originalName = pkg.name;

pkg.name = 'foam-core';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const { execSync } = require('child_process');
try {
  execSync('npm publish --registry https://registry.npmjs.org/', { stdio: 'inherit' });
} finally {
  pkg.name = originalName;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
