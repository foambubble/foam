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
import { cleanWorkspace } from './test-utils-vscode';
import path from 'path';

const rootDir = path.join(__dirname, '../..');

export function run(): Promise<void> {
  const errWrite = process.stderr.write;

  let remaining = '';
  process.stderr.write = (buffer: string) => {
    const lines = (remaining + buffer).split('\n');
    remaining = lines.pop() as string;
    // Trim long lines because some uninformative code dumps will flood the
    // console or, worse, be suppressed altogether because of their size.
    lines.forEach(l => console.log(l.substr(0, 300)));
    return true;
  };

  // process.on('unhandledRejection', err => {
  //   throw err;
  // });

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    await cleanWorkspace();
    try {
      const { results } = await runCLI(
        {
          rootDir,
          roots: ['<rootDir>/src'],
          runInBand: true,
          testRegex: '\\.(test|spec)\\.ts$',
          testEnvironment: '<rootDir>/src/test/support/vscode-environment.js',
          setupFiles: ['<rootDir>/src/test/support/jest-setup.ts'],
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
      await cleanWorkspace();
    }
  });
}
