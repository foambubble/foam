/**
 * Custom Vitest pool that runs test files in the VS Code extension host
 * main process (no worker forks/threads).
 *
 * This is required because `require('vscode')` only works in the extension
 * host process. Vitest's default worker pools (forks / threads) start fresh
 * Node processes / isolates that don't inherit VS Code's Module._load patch,
 * so they cannot resolve the 'vscode' virtual module.
 *
 * By running tests directly in the main process we replicate the behaviour
 * of the old Jest `runInBand: true` setup.
 *
 * Configuration (via poolOptions.vscode in vitest config):
 *   srcDir  — source directory, relative to root (default: 'src')
 *   outDir  — tsc output directory, relative to root (default: 'out')
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import {
  startTests,
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from '@vitest/runner';
import { fn as viFn, spyOn as viSpyOn, mocks } from '@vitest/spy';
import {
  JestChaiExpect,
  JestExtend,
  JestAsymmetricMatchers,
  GLOBAL_EXPECT,
} from '@vitest/expect';

const __filename = fileURLToPath(import.meta.url);
const _require = createRequire(__filename);

// ---------------------------------------------------------------------------
// Build standalone expect() — initialised on first use
// ---------------------------------------------------------------------------
let _expect: any = null;

async function getExpect() {
  if (_expect) return _expect;
  const chai = await import('chai');
  chai.use(JestChaiExpect);
  chai.use(JestExtend);
  chai.use(JestAsymmetricMatchers);
  (globalThis as any)[GLOBAL_EXPECT] = chai.expect;
  _expect = chai.expect;
  return _expect;
}

// ---------------------------------------------------------------------------
// vi object backed by @vitest/spy (no worker context required)
// ---------------------------------------------------------------------------
const vi = {
  fn: viFn,
  spyOn: viSpyOn,
  clearAllMocks: () => { for (const m of mocks) m.mockClear(); },
  resetAllMocks: () => { for (const m of mocks) m.mockReset(); },
  restoreAllMocks: () => { for (const m of mocks) m.mockRestore(); },
  mock: (_id: string, _factory?: () => unknown) => {},
  unmock: (_id: string) => {},
  useFakeTimers: () => {},
  useRealTimers: () => {},
  advanceTimersByTime: (_ms: number) => {},
  runAllTimers: () => {},
};

// ---------------------------------------------------------------------------
// Pool factory — called by Vitest in the main process
// ---------------------------------------------------------------------------
export default function createPool(ctx: any) {
  const rootDir = ctx.config.root as string;
  const opts = (ctx.config.poolOptions as any)?.vscode ?? {};
  const srcDir = path.join(rootDir, (opts.srcDir as string) ?? 'src');
  const outDir = path.join(rootDir, (opts.outDir as string) ?? 'out');

  /** Convert a source .ts path to the compiled .js path in outDir. */
  function toCompiledPath(srcFilepath: string): string {
    const rel = path.relative(srcDir, srcFilepath);
    return path.join(outDir, rel.replace(/\.ts$/, '.js'));
  }

  // Use the project's actual config name so that File task IDs (hashed from
  // relative path + project name) match the taskId on TestSpecification objects.
  const projectName = (ctx.projects?.[0]?.config?.name as string) ?? '';

  const runner = {
    config: {
      root: rootDir,
      name: projectName,
      passWithNoTests: true,
      maxConcurrency: 1,
      testTimeout: 30000,
      hookTimeout: 10000,
      teardownTimeout: 1000,
      // Map any configured setupFiles through toCompiledPath so they run
      // inside the extension host process alongside the test files.
      setupFiles: ((ctx.config.setupFiles as string[]) ?? []).map(toCompiledPath),
      sequence: { shuffle: false, concurrent: false, hooks: 'stack' as const },
    },

    async importFile(filepath: string, _source: 'collect' | 'run') {
      const compiled = toCompiledPath(filepath);
      try {
        delete _require.cache[compiled];
        _require(compiled);
      } catch (e) {
        console.error('[vitest-pool-vscode] importFile error:', path.basename(compiled), (e as Error).message);
        throw e;
      }
    },

    /** clearMocks: true — clear after every test */
    onAfterRunTask() {
      for (const m of mocks) m.mockClear();
    },

    /** Forward collected file state to Vitest so reporters work */
    onCollected(files: any[]) {
      const project = ctx.projects?.[0];
      if (project && files.length) {
        try {
          ctx.state?.collectFiles?.(project, files);
        } catch (e) {
          console.warn('[vitest-pool-vscode] collectFiles error:', (e as Error).message);
        }
        ctx.report?.('onCollected', files).catch((e: Error) => {
          console.warn('[vitest-pool-vscode] report onCollected error:', e.message);
        });
      }
    },

    /** Forward task result packs to Vitest's state manager */
    onTaskUpdate(packs: any[]) {
      if (!packs.length) return;
      try { ctx.state?.updateTasks?.(packs); } catch (e) {
        console.warn('[vitest-pool-vscode] updateTasks error:', (e as Error).message);
      }
      ctx.report?.('onTaskUpdate', packs).catch(() => {});
    },
  };

  async function execTests(specs: any[]) {
    const expect = await getExpect();
    Object.assign(globalThis, {
      describe, it, test,
      beforeAll, afterAll, beforeEach, afterEach,
      expect, vi,
    });
    const files = specs.map((s: any) => s.moduleId ?? s[1]);
    await startTests(files, runner as any);
  }

  return {
    name: 'vscode',
    async runTests(specs: any[]) { await execTests(specs); },
    async collectTests(specs: any[]) { await execTests(specs); },
    async close() {},
  };
}
