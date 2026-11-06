#!/usr/bin/env node
//
// Releases foam-vscode to the VS Code Marketplace and OpenVSX.
//
// Invoked by the workspace `release` script. Steps are explicit (not
// relying on vsce's `vscode:prepublish` lifecycle hook) so the flow is
// inspectable from this single file.
//
// Both registries authenticate through GitHub Actions OIDC (trusted
// publishing), so this only publishes from a workflow job with
// `id-token: write`. Both uploads skip a version the registry already has,
// so a rerun after a partial failure completes the other one.
//
const { execSync } = require('child_process');

const run = cmd => execSync(cmd, { stdio: 'inherit' });

// 1. Clean + production build for both Node and web targets
//    (was: vscode:prepublish).
run('yarn clean');
run('yarn build:node --production');
run('yarn build:web --production');

// 2. Package the .vsix.
run('yarn package');

// 3. Upload to the Marketplace.
run('yarn publish:vscode');

// 4. Upload the same vsix to OpenVSX.
run('yarn publish:openvsx');
