// Based on https://github.com/svsool/vscode-memo/blob/master/src/test/testRunner.ts
/**
 * We use the following convention in Foam:
 * - *.test.ts are unit tests
 *   they might still rely on vscode API and hence will be run in this environment, but
 *   are fundamentally about testing functions in isolation
 * - *.spec.ts are integration tests
 *   they will make direct use of the vscode API to be invoked as commands, create editors,
 *   and so on..
 */

/* eslint-disable import/first */

// Set before imports, see https://github.com/facebook/jest/issues/12162
process.env.FORCE_COLOR = '1';
process.env.NODE_ENV = 'test';

// eslint-disable-next-line import/no-extraneous-dependencies
import { runCLI } from '@jest/core';
import path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';

const rootDir = path.join(__dirname, '..', '..');

function getUnitReadySpecFiles(rootDir: string): string[] {
  const specFiles = glob.sync('**/*.spec.ts', {
    cwd: path.join(rootDir, 'src'),
  });
  const unitReadyFiles: string[] = [];

  for (const file of specFiles) {
    const fullPath = path.join(rootDir, 'src', file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check for @unit-ready annotation in file
      if (
        content.includes('/* @unit-ready */') ||
        content.includes('// @unit-ready')
      ) {
        unitReadyFiles.push(file);
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return unitReadyFiles;
}

export function runUnit(
  extraArgs: string[] = [],
  excludeSpecs = false
): Promise<void> {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const { results } = await runCLI(
        {
          rootDir,
          roots: ['<rootDir>/src'],
          runInBand: true,
          testRegex: excludeSpecs
            ? ['\\.(test)\\.ts$']
            : (() => {
                const unitReadySpecs = getUnitReadySpecFiles(rootDir);

                // Create pattern that includes .test files + specific .spec files
                return [
                  '\\.(test)\\.ts$', // All .test files
                  ...unitReadySpecs.map(
                    file =>
                      file.replace(/\//g, '\\/').replace(/\./g, '\\.') + '$'
                  ),
                ];
              })(),
          setupFiles: ['<rootDir>/src/test/support/jest-setup.ts'],
          setupFilesAfterEnv: [
            '<rootDir>/src/test/support/jest-setup-after-env.ts',
          ],
          testTimeout: 20000,
          verbose: false,
          silent: false,
          colors: true,
          // Pass through any additional args
          _: extraArgs,
        } as any,
        [rootDir]
      );

      const failures = results.testResults.reduce(
        (acc, res) => (res.failureMessage ? acc + 1 : acc),
        0
      );

      return failures === 0
        ? resolve()
        : reject(`${failures} tests have failed!`);
    } catch (error) {
      return reject(error);
    }
  });
}
