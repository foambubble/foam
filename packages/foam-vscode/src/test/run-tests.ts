import path from 'path';
import { runTests } from 'vscode-test';
import { runUnit } from './suite-unit';

function parseArgs(): {
  unit: boolean;
  e2e: boolean;
  excludeSpecs: boolean;
  jestArgs: string[];
} {
  const args = process.argv.slice(2);
  const unit = args.includes('--unit');
  const e2e = args.includes('--e2e');
  const excludeSpecs = args.includes('--exclude-specs');

  // Filter out our custom flags and pass the rest to Jest
  const jestArgs = args.filter(
    arg => !['--unit', '--e2e', '--exclude-specs'].includes(arg)
  );

  return unit || e2e
    ? { unit, e2e, excludeSpecs, jestArgs }
    : { unit: true, e2e: true, excludeSpecs, jestArgs };
}

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
  const { unit, e2e, excludeSpecs, jestArgs } = parseArgs();

  let isSuccess = true;

  if (unit) {
    try {
      console.log('Running unit tests');
      await runUnit(jestArgs, excludeSpecs);
    } catch (err) {
      console.log('Error occurred while running Foam unit tests:', err);
      isSuccess = false;
    }
  }

  if (e2e) {
    try {
      console.log('Running e2e tests');
      // The folder containing the Extension Manifest package.json
      // Passed to `--extensionDevelopmentPath`
      const extensionDevelopmentPath = path.join(__dirname, '..', '..');
      // The path to the extension test script
      // Passed to --extensionTestsPath
      const extensionTestsPath = path.join(__dirname, 'suite');

      const testWorkspace = path.join(
        extensionDevelopmentPath,
        '.test-workspace'
      );

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
        version: '1.109.0',
      });
    } catch (err) {
      console.log('Error occurred while running Foam e2e tests:', err);
      isSuccess = false;
    }
  }

  if (!isSuccess) {
    // throw new Error('Some Foam tests failed');
    console.log('Some Foam tests failed');
    process.exit(1);
  }
}

main();
