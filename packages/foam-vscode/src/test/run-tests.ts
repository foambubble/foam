import * as path from 'path';
import fs from 'fs';
import os from 'os';
import { runTests } from 'vscode-test';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite');

    const tmpWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-'));

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [tmpWorkspaceDir, '--disable-extensions'],
      // Running the tests with vscode 1.53.0 is causing issues in `suite.ts:23`,
      // which is causing a stack overflow, possibly due to a recursive callback.
      // Also see https://github.com/foambubble/foam/pull/479#issuecomment-774167127
      // Forcing the version to 1.52.0 solves the problem.
      // TODO: to review, further investigate, and roll back this workaround.
      version: '1.52.0',
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
