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
// eslint-disable-next-line import/no-extraneous-dependencies
import * as glob from 'glob';

const rootDir = path.join(__dirname, '..', '..');

function parseJestArgs(args: string[]): any {
  const config: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--testNamePattern' && i + 1 < args.length) {
      config.testNamePattern = args[i + 1];
      i++; // Skip next arg as it's the value
    } else if (arg === '--testPathPattern' && i + 1 < args.length) {
      config.testPathPattern = args[i + 1].split('/').at(-1) || args[i + 1];
      i++; // Skip next arg as it's the value
    } else if (arg === '--json') {
      config.json = true;
    } else if (arg === '--useStderr') {
      config.useStderr = true;
    } else if (arg === '--outputFile' && i + 1 < args.length) {
      config.outputFile = args[i + 1];
      i++; // Skip next arg as it's the value
    } else if (arg === '--no-coverage') {
      config.collectCoverage = false;
    } else if (arg === '--watchAll=false') {
      config.watchAll = false;
    } else if (arg === '--colors') {
      config.colors = true;
    } else if (arg === '--reporters' && i + 1 < args.length) {
      if (!config.reporters) {
        config.reporters = [];
      }
      config.reporters.push(args[i + 1]);
      i++; // Skip next arg as it's the value
    }
  }

  return config;
}

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
        Object.assign(
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
          },
          // Parse additional Jest arguments into config object
          parseJestArgs(extraArgs)
        ) as any,
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
