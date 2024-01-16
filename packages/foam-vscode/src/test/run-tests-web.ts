import * as path from 'path';
import { runTests } from '@vscode/test-web';

async function main() {
  let isSuccess = true;

  try {
    console.log('Running e2e tests');
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.join(__dirname, '..', '..', '..');
    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.join(__dirname, 'suite-web');

    const testWorkspace = path.join(
      extensionDevelopmentPath,
      '.test-workspace'
    );

    const attachArgName = '--waitForDebugger=';
    const waitForDebugger = process.argv.find(arg =>
      arg.startsWith(attachArgName)
    );

    // Download VS Code, unzip it and run the integration test
    await runTests({
      browserType: 'firefox',
      extensionDevelopmentPath,
      extensionTestsPath,
      version: '1.70.0',
      folderPath: testWorkspace,
      waitForDebugger: waitForDebugger
        ? Number(waitForDebugger.slice(attachArgName.length))
        : undefined,
    });
  } catch (err) {
    console.error('Error occurred while running Foam e2e tests:', err);
    isSuccess = false;
  }

  if (!isSuccess) {
    // throw new Error('Some Foam tests failed');
    console.log('Some Foam tests failed');
    process.exit(1);
  }
}

main();
