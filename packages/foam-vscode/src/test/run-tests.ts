import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
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

    // Use an isolated user data dir so the test VS Code instance doesn't touch
    // the real user profile. Pre-populate it with settings that disable local
    // file history, which otherwise races with test files being deleted during
    // cleanup and produces ENOENT errors in the output.
    const userDataDir = path.join(extensionDevelopmentPath, '.vscode-test-user-data');
    const userSettingsDir = path.join(userDataDir, 'User');
    mkdirSync(userSettingsDir, { recursive: true });
    writeFileSync(
      path.join(userSettingsDir, 'settings.json'),
      JSON.stringify({ 'workbench.localHistory.enabled': false })
    );

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        `--user-data-dir=${userDataDir}`,
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
