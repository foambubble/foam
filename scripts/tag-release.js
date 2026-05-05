#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGES = [
  // { dir: 'packages/foam-vscode', tagPrefix: 'vscode' },
  { dir: 'packages/foam-cli', tagPrefix: 'cli' },
  // { dir: 'packages/foam-core', tagPrefix: 'core' },
];

const repoRoot = path.resolve(__dirname, '..');

function readVersion(pkgDir) {
  const pkgPath = path.join(repoRoot, pkgDir, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

function tagExists(tag) {
  const out = execSync(`git tag --list ${tag}`, { cwd: repoRoot }).toString().trim();
  return out === tag;
}

function main() {
  const created = [];
  const skipped = [];

  for (const { dir, tagPrefix } of PACKAGES) {
    const version = readVersion(dir);
    const tag = `${tagPrefix}@${version}`;

    if (tagExists(tag)) {
      skipped.push(tag);
      continue;
    }

    execSync(`git tag ${tag}`, { cwd: repoRoot, stdio: 'inherit' });
    created.push(tag);
  }

  if (created.length > 0) {
    console.log(`Created tags: ${created.join(', ')}`);
  }
  if (skipped.length > 0) {
    console.log(`Already existed (skipped): ${skipped.join(', ')}`);
  }
  if (created.length === 0 && skipped.length === PACKAGES.length) {
    console.log('Nothing to tag — all package versions already have tags.');
  }
  if (created.length > 0) {
    console.log('\nPush with: git push --tags');
  }
}

main();
