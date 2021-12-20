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

process.env.FORCE_COLOR = '1';
process.env.NODE_ENV = 'test';

import path from 'path';
import { runCLI } from '@jest/core';

const rootDir = path.join(__dirname, '..', '..');

export function runUnit(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const { results } = await runCLI(
        {
          rootDir,
          roots: ['<rootDir>/src'],
          runInBand: true,
          testRegex: '\\.(test)\\.ts$',
          setupFiles: ['<rootDir>/src/test/support/jest-setup.ts'],
          testTimeout: 20000,
          verbose: false,
          silent: false,
          colors: true,
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
