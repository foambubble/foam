/**
 * Verdict for an e2e run, kept separate from the runner so it can be unit
 * tested without an extension host.
 *
 * Checking only for files in a `fail` state is not enough: when the run breaks
 * before any test executes — an incompatible pool, a collection error — Vitest
 * records an unhandled error and leaves the file list empty, so a `fail` filter
 * finds nothing and the runner exits 0. A suite that ran no tests is a failure,
 * not a pass.
 */

export interface E2eRunTask {
  type?: string;
  name?: string;
  result?: { state?: string };
  tasks?: E2eRunTask[];
}

export interface E2eRunState {
  files: E2eRunTask[];
  unhandledErrors: unknown[];
}

function countTests(task: E2eRunTask): number {
  if (task.type === 'test') {
    return 1;
  }
  return (task.tasks ?? []).reduce((sum, t) => sum + countTests(t), 0);
}

/**
 * Returns a message describing why the run should be considered failed, or
 * `undefined` if it genuinely passed.
 */
export function getE2eRunFailure(state: E2eRunState): string | undefined {
  const { files, unhandledErrors } = state;

  // Reported first: an unhandled error explains an empty or partial file list,
  // so it is the more useful message when both conditions hold.
  if (unhandledErrors.length > 0) {
    const details = unhandledErrors
      .map(e => (e instanceof Error ? e.message : String(e)))
      .join('\n  ');
    return `Vitest reported ${unhandledErrors.length} unhandled error(s) during the e2e run:\n  ${details}`;
  }

  if (files.length === 0) {
    return 'No test files were collected — the e2e suite did not run. Check the Vitest include patterns and the pool configuration.';
  }

  const testCount = files.reduce((sum, f) => sum + countTests(f), 0);
  if (testCount === 0) {
    return `No tests ran: ${files.length} test file(s) were collected but contained no executed test cases.`;
  }

  const failures = files.filter(f => f.result?.state === 'fail');
  if (failures.length > 0) {
    const names = failures.map(f => f.name ?? '<unknown>').join(', ');
    return `${failures.length} of ${files.length} test files failed: ${names}`;
  }

  return undefined;
}
