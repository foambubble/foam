import * as path from 'path';
import { runTests } from '@vscode/test-web';

async function main() {
  let isSuccess = true;

  try {
    console.log('Running e2e tests');
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../src');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.join(__dirname, 'suite-web.js');

    const testWorkspace = path.join(
      extensionDevelopmentPath,
      '.test-workspace'
    );

    // Download VS Code, unzip it and run the integration test
    await runTests({
      browserType: 'chromium',
      headless: false,
      extensionDevelopmentPath,
      extensionTestsPath,
      quality: 'stable',
      folderPath: testWorkspace,
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
