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

import { EOL } from 'os';
import path from 'path';
import { runCLI } from '@jest/core';

const rootDir = path.resolve(__dirname, '../..');

export function run(): Promise<void> {
  const errWrite = process.stderr.write;
  process.stderr.write = (buffer: string) => {
    console.log(buffer);
    return true;
  };
  // process.on('unhandledRejection', err => {
  //   throw err;
  // });
  process.env.FORCE_COLOR = '1';
  process.env.NODE_ENV = 'test';
  process.env.BABEL_ENV = 'test';

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
          testTimeout: 30000,
          useStderr: true,
          verbose: true,
          colors: true,
        } as any,
        [rootDir]
      );

      const failures = results.testResults.reduce((acc, res) => {
        if (res.failureMessage) {
          acc.push(res as any);
        }
        return acc;
      }, [] as jest.TestResult[]);

      if (failures.length > 0) {
        console.log('Some Foam tests failed: ', failures.length);
        reject(`Some Foam tests failed: ${failures.length}`);
      } else {
        resolve();
      }
    } catch (error) {
      console.log('There was an error while running the Foam suite', error);
      return reject(error);
    } finally {
      process.stderr.write = errWrite.bind(process.stderr);
    }
  });
}
