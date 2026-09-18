import { getE2eRunFailure } from './e2e-run-result';

/**
 * Regression guard for the ten weeks in which `test:e2e` exited 0 while the
 * Vitest 4 / custom-pool incompatibility stopped all 38 specs from running.
 */
describe('getE2eRunFailure', () => {
  const passingFile = (name: string) => ({
    name,
    result: { state: 'pass' },
    tasks: [{ type: 'test', name: 'a test', result: { state: 'pass' } }],
  });

  it('reports no failure when every collected file passed', () => {
    expect(
      getE2eRunFailure({
        files: [passingFile('a.spec.ts'), passingFile('b.spec.ts')],
        unhandledErrors: [],
      })
    ).toBeUndefined();
  });

  it('fails when no test files were collected at all', () => {
    const failure = getE2eRunFailure({ files: [], unhandledErrors: [] });
    expect(failure).toMatch(/no test files/i);
  });

  it('fails when files were collected but no test case ran', () => {
    const failure = getE2eRunFailure({
      files: [{ name: 'a.spec.ts', result: { state: 'pass' }, tasks: [] }],
      unhandledErrors: [],
    });
    expect(failure).toMatch(/no tests ran/i);
  });

  it('fails on unhandled errors even when no file is marked failed', () => {
    const failure = getE2eRunFailure({
      files: [],
      unhandledErrors: [
        new Error(
          'Runner /src/test/support/vitest-pool-vscode.ts is not supported. Test files: /src/a.spec.ts.'
        ),
      ],
    });
    expect(failure).toMatch(/unhandled error/i);
    expect(failure).toContain('is not supported');
  });

  it('reports unhandled errors ahead of a missing-files verdict', () => {
    const failure = getE2eRunFailure({
      files: [passingFile('a.spec.ts')],
      unhandledErrors: [new Error('collection blew up')],
    });
    expect(failure).toMatch(/unhandled error/i);
  });

  it('fails when a collected file failed', () => {
    const failure = getE2eRunFailure({
      files: [
        passingFile('a.spec.ts'),
        {
          name: 'b.spec.ts',
          result: { state: 'fail' },
          tasks: [{ type: 'test', name: 'broken', result: { state: 'fail' } }],
        },
      ],
      unhandledErrors: [],
    });
    expect(failure).toMatch(/1 of 2 test files failed/i);
  });

  it('counts tests nested inside suites', () => {
    expect(
      getE2eRunFailure({
        files: [
          {
            name: 'a.spec.ts',
            result: { state: 'pass' },
            tasks: [
              {
                type: 'suite',
                name: 'a suite',
                tasks: [
                  { type: 'test', name: 'nested', result: { state: 'pass' } },
                ],
              },
            ],
          },
        ],
        unhandledErrors: [],
      })
    ).toBeUndefined();
  });

  it('does not count a file whose suites are all empty as having run tests', () => {
    const failure = getE2eRunFailure({
      files: [
        {
          name: 'a.spec.ts',
          result: { state: 'pass' },
          tasks: [{ type: 'suite', name: 'an empty suite', tasks: [] }],
        },
      ],
      unhandledErrors: [],
    });
    expect(failure).toMatch(/no tests ran/i);
  });
});
