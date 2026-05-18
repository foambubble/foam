#!/usr/bin/env node
//
// Releases @foam/cli to npm under the public name `foam-cli`.
//
// Invoked by the workspace `release` script. Steps are explicit (not
// relying on npm's `prepublishOnly` lifecycle hook) so the flow is
// inspectable from this single file.
//
const fs = require('fs');
const { execSync } = require('child_process');

const run = cmd => execSync(cmd, { stdio: 'inherit' });

// 1. Clean + production build (was: prepublishOnly).
run('yarn clean');
run('node esbuild.js --production');

// 2. Rename to `foam-cli` for the public registry (the workspace name
//    `@foam/cli` is monorepo-internal). Workspace deps `@foam/core` and
//    `@foam/mcp` live in `devDependencies` and so are already excluded from
//    the published manifest; esbuild bundles their code into the output.
//
//    We modify package.json in place (npm only reads from cwd) but keep an
//    on-disk backup at package.json.bak first. If the process is killed
//    between the in-place edit and the `finally` restore (kill -9, power
//    loss), the backup is the recovery path: `mv package.json.bak package.json`.
const pkgPath = './package.json';
const backupPath = `${pkgPath}.bak`;
const originalContent = fs.readFileSync(pkgPath, 'utf8');
fs.writeFileSync(backupPath, originalContent);

const pkg = JSON.parse(originalContent);
pkg.name = 'foam-cli';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 3. Publish, restoring package.json afterwards no matter what, and only
//    delete the backup once the restore is confirmed on disk.
try {
  run('npm publish --registry https://registry.npmjs.org/');
} finally {
  fs.writeFileSync(pkgPath, originalContent);
  fs.unlinkSync(backupPath);
}
