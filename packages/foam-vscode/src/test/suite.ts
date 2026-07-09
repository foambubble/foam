/**
 * E2E test suite runner — executes all *.spec.ts files
 * inside the VS Code extension host using Vitest's programmatic API.
 *
 * We use the following convention in Foam:
 * - *.test.ts are unit tests (testing functions in isolation)
 * - *.spec.ts are integration tests (direct use of VS Code API)
 *
 * We use a custom in-process pool (vitest-pool-vscode.ts) so that tests run
 * inside the extension host process where require('vscode') is available.
 * Vitest's default worker pools (forks / threads) cannot resolve 'vscode'
 * because VS Code's Module._load patch is only active in the main process.
 */

// Set before imports
process.env.FORCE_COLOR = '1';
process.env.NODE_ENV = 'test';
// Vitest's TTY renderer uses ANSI cursor-movement codes to overwrite lines
// in-place (live-updating view). The VS Code extension host pipes stdout
// through its own capture layer, so the live-render frames are lost and
// only the final cleared state survives — individual test names never
// appear. Force non-TTY unconditionally so the verbose reporter prints
// each result as a plain new line that persists in the output.
(process.stdout as any).isTTY = false;
(process.stderr as any).isTTY = false;

import { rmSync, readdirSync, existsSync } from 'fs';
import { Config } from '@foam/core';
import { VsCodeFoamConfig } from '../vscode/config';
import { cleanWorkspace } from './test-utils-vscode';
import path from 'path';

const rootDir = path.join(__dirname, '../..');

export async function run(): Promise<void> {
  const errWrite = process.stderr.write;

  // The extension under test runs from the esbuild bundle, which carries its
  // own inlined copy of @foam/core — its activation wires the bundle's Config,
  // not the node_modules instance the compiled specs import. Wire this module
  // graph's Config the same way extension.ts does, so specs reading through
  // Config see the real VS Code configuration.
  Config.setDefaultConfig(new VsCodeFoamConfig());

  // Redirect stderr → stdout so VS Code's internal warnings appear inline with
  // test output rather than on a separate stream (which the test harness may
  // suppress or emit out of order). Lines are capped to avoid log flooding.
  let remaining = '';
  process.stderr.write = (buffer: string) => {
    const lines = (remaining + buffer).split('\n');
    remaining = lines.pop() as string;
    lines.forEach(l => { if (l.trim()) console.log(l.substr(0, 300)); });
    return true;
  };

  await cleanWorkspace();
  const testWorkspace = path.join(__dirname, '..', '..', '.test-workspace');

  // Clean test workspace
  if (existsSync(testWorkspace)) {
    for (const entry of readdirSync(testWorkspace)) {
      if (entry === '.keep') continue;
      rmSync(path.join(testWorkspace, entry), { recursive: true, force: true });
    }
  }

  // Foam-specific: disable link reference definitions during tests
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    if (vscode?.workspace) {
      await vscode.workspace
        .getConfiguration()
        .update('foam.edit.linkReferenceDefinitions', 'off');
    }
  } catch (e) {
    // vscode not available outside extension host — ignore
  }

  try {
    const { startVitest } = await import('vitest/node');

    const vitest = await startVitest('test', [], {
      root: rootDir,
      include: ['src/**/*.spec.ts'],
      exclude: ['src/test/web/**', 'node_modules/**', '.vscode-test/**'],
      // Custom in-process pool: runs tests in the extension host main process
      // so that require('vscode') resolves via VS Code's Module._load patch.
      pool: path.join(rootDir, 'src/test/support/vitest-pool-vscode.ts'),
      poolOptions: { vscode: { outDir: 'out' } },
      globals: true,
      testTimeout: 30000,
      fileParallelism: false,
      watch: false,
      reporter: 'verbose',
    } as any, { configFile: false } as any);

    if (!vitest) {
      throw new Error('Failed to start Vitest');
    }

    const failures = vitest.state.getFiles().filter(
      (f: any) => f.result?.state === 'fail'
    );

    await vitest.close();

    if (failures.length > 0) {
      throw new Error(`Some Foam tests failed: ${failures.length}`);
    }
  } catch (error) {
    console.log('There was an error while running the Foam e2e suite', error);
    throw error;
  } finally {
    process.stderr.write = errWrite.bind(process.stderr);
    await cleanWorkspace();
  }
}
