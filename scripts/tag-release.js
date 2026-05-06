#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGES = [
  { dir: 'packages/foam-vscode', tagPrefix: 'vscode' },
  { dir: 'packages/foam-cli', tagPrefix: 'cli' },
  { dir: 'packages/foam-core', tagPrefix: 'core' },
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

function tagOne({ dir, tagPrefix }) {
  const version = readVersion(dir);
  const tag = `${tagPrefix}@${version}`;
  if (tagExists(tag)) {
    console.log(`Already existed (skipped): ${tag}`);
    return { tag, created: false };
  }
  execSync(`git tag ${tag}`, { cwd: repoRoot, stdio: 'inherit' });
  console.log(`Created tag: ${tag}`);
  return { tag, created: true };
}

function main() {
  const onlyPrefix = process.argv[2];
  const targets = onlyPrefix
    ? PACKAGES.filter(p => p.tagPrefix === onlyPrefix)
    : PACKAGES;

  if (onlyPrefix && targets.length === 0) {
    console.error(`Unknown tag prefix: ${onlyPrefix}. Known: ${PACKAGES.map(p => p.tagPrefix).join(', ')}`);
    process.exit(1);
  }

  const results = targets.map(tagOne);
  const anyCreated = results.some(r => r.created);
  if (!anyCreated) {
    console.log('Nothing to tag.');
  } else {
    console.log('\nPush with: git push --tags');
  }
}

main();
