import path from 'path';
import { runTests } from 'vscode-test';

function getVSCodePlatform(): string {
  switch (process.platform) {
    case 'darwin':
      return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin';
    case 'win32':
      return process.arch === 'arm64'
        ? 'win32-arm64-archive'
        : 'win32-x64-archive';
    default: // linux
      return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  }
}

async function main() {
  try {
    console.log('Running e2e tests');
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.join(__dirname, '..', '..');
    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.join(__dirname, 'suite');

    const testWorkspace = path.join(extensionDevelopmentPath, '.test-workspace');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-gpu',
        '--disable-extensions',
        '--disable-workspace-trust',
        '--disable-updates',
      ],
      platform: getVSCodePlatform(),
      version: '1.110.0',
    });
  } catch (err) {
    console.log('Error occurred while running Foam e2e tests:', err);
    process.exit(1);
  }
}

main();
