import { describe, expect, it } from 'vitest';
import type { LoopResult } from './loop.ts';
import { render } from './render.ts';

function result(overrides: Partial<LoopResult> = {}): LoopResult {
  return {
    runDir: '/repo/.agent-loop/demo/run',
    rounds: 2,
    stopped: 'no MUST_FIX findings left',
    blocked: false,
    findings: [],
    outcomes: {},
    cold: [],
    costUsd: 1.234,
    ...overrides,
  };
}

describe('render', () => {
  it('states the rounds, the cost and why the loop stopped', () => {
    const text = render(result());
    expect(text).toContain('2 rounds, $1.23');
    expect(text).toContain('Stopped: no MUST_FIX findings left.');
  });

  it("shows each finding with the coder's outcome and reason as returned", () => {
    const text = render(
      result({
        findings: [
          { id: 'R1', source: 'reviewer', round: 1, tier: 'MUST_FIX', path: 'src/a.ts', line: 12, finding: 'drops tabs' },
          { id: 'R2', source: 'reviewer', round: 1, tier: 'NIT', path: 'src/b.ts', line: null, finding: 'rename x' },
        ],
        outcomes: {
          R1: { outcome: 'fixed', reason: 'tabs are kept now' },
          R2: { outcome: 'rejected', reason: 'x matches the core API' },
        },
      })
    );
    expect(text).toMatch(/R1 \| reviewer \| `src\/a\.ts:12` drops tabs \| MUST_FIX \| fixed: tabs are kept now \|/);
    expect(text).toMatch(/R2 \| reviewer \| `src\/b\.ts` rename x \| NIT \| rejected: x matches the core API \|/);
  });

  it('shows a finding nobody answered as open', () => {
    const text = render(
      result({ findings: [{ id: 'M1', source: 'maintainer', round: 2, finding: 'also cover leap years' }] })
    );
    expect(text).toMatch(/M1 \| maintainer \| also cover leap years \| {2}\| open \|/);
  });

  it('keeps the suite output out of the summary', () => {
    const text = render(
      result({
        findings: [{ id: 'S1', source: 'suite', round: 1, finding: '`yarn test` failed', detail: 'thousands of lines' }],
      })
    );
    expect(text).toContain('`yarn test` failed');
    expect(text).not.toContain('thousands of lines');
  });

  it('escapes table syntax inside a finding', () => {
    const text = render(
      result({ findings: [{ id: 'M1', source: 'maintainer', round: 1, finding: 'use a | b\nnot c' }] })
    );
    expect(text).toContain('use a \\| b<br>not c');
  });

  it('lists the cold findings apart, for the maintainer', () => {
    const text = render(
      result({ cold: [{ id: 'C1', source: 'cold', round: 2, tier: 'SHOULD', path: 'src/c.ts', line: 3, finding: 'dead code' }] })
    );
    expect(text).toMatch(/#### Cold pass[\s\S]*C1 \| `src\/c\.ts:3` dead code \| SHOULD \|/);
  });

  it('says when the cold pass found nothing, and when it did not run', () => {
    expect(render(result({ cold: [] }))).toContain('The cold pass found nothing.');
    expect(render(result({ cold: null, blocked: true }))).toContain('No cold pass: the coder is blocked.');
  });
});
