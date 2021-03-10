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

import path from 'path';
import { runCLI } from '@jest/core';

const rootDir = path.resolve(__dirname, '../..');

export function run(): Promise<void> {
  process.stdout.write = (buffer: string) => {
    console.log(buffer);
    return true;
  };
  process.stderr.write = (buffer: string) => {
    console.error(buffer);
    return true;
  };
  process.env.FORCE_COLOR = '1';
  process.env.NODE_ENV = 'test';

  return new Promise(async (resolve, reject) => {
    try {
      const { results } = await runCLI(
        {
          rootDir,
          roots: ['<rootDir>/src'],
          transform: JSON.stringify({ '^.+\\.ts$': 'ts-jest' }),
          runInBand: true,
          testRegex: '\\.(test|spec)\\.ts$',
          testEnvironment:
            '<rootDir>/src/test/support/extended-vscode-environment.js',
          setupFiles: ['<rootDir>/src/test/support/jest-setup.ts'],
          setupFilesAfterEnv: ['jest-extended'],
          globals: JSON.stringify({
            'ts-jest': {
              tsconfig: path.resolve(rootDir, './tsconfig.json'),
            },
          }),
          testTimeout: 20000,
          verbose: true,
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
