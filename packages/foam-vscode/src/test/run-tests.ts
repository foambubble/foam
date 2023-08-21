import rf from 'rimraf';
import path from 'path';
import { runTests } from 'vscode-test';
import { runUnit } from './suite-unit';

function parseArgs(): { unit: boolean; e2e: boolean } {
  const args = process.argv.slice(2);
  const unit = args.some(arg => arg === '--unit');
  const e2e = args.some(arg => arg === '--e2e');
  return unit || e2e ? { unit, e2e } : { unit: true, e2e: true };
}

async function main() {
  const { unit, e2e } = parseArgs();

  let isSuccess = true;

  if (unit) {
    try {
      console.log('Running unit tests');
      await runUnit();
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
      // clean test workspace
      rf.sync(path.join(testWorkspace, '*'));
      rf.sync(path.join(testWorkspace, '.vscode'));
      rf.sync(path.join(testWorkspace, '.foam'));

      // Download VS Code, unzip it and run the integration test
      await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        launchArgs: [
          testWorkspace,
          '--disable-extensions',
          '--disable-workspace-trust',
        ],
        version: '1.70.0',
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
