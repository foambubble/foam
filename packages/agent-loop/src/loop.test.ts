import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LoopError, type LoopOptions, runLoop } from './loop.ts';
import { makeRepo, type TestRepo } from './test/repo.ts';
import { clean, done, FAIL, mustFix, PASS, queue, scripted } from './test/sessions.ts';

function options(repo: TestRepo, overrides: Partial<LoopOptions>): LoopOptions {
  return {
    root: repo.root,
    slug: repo.slug,
    specDir: repo.specDir,
    rounds: 3,
    gate: [PASS],
    feedback: queue(),
    sessions: {
      coder: scripted(),
      reviewer: scripted(),
      cold: scripted(() => clean),
    },
    ...overrides,
  };
}

describe('starting', () => {
  it('briefs round 1 with the spec', async () => {
    const repo = makeRepo();
    const coder = scripted(() => (repo.commit('a.txt', 'a'), done()));
    await runLoop(options(repo, { sessions: { coder, reviewer: scripted(() => clean), cold: scripted(() => clean) } }));
    expect(coder.briefs[0]).toContain('specs/demo/spec.md');
  });

  it('points round 1 at the plan when there is one', async () => {
    const repo = makeRepo({ plan: true });
    const coder = scripted(() => (repo.commit('a.txt', 'a'), done()));
    await runLoop(options(repo, { sessions: { coder, reviewer: scripted(() => clean), cold: scripted(() => clean) } }));
    expect(coder.briefs[0]).toContain('specs/demo/plan.md');
  });

  it('passes the instructions to round 1 verbatim', async () => {
    const repo = makeRepo();
    const instructions = 'Keep the "legacy" flag,\nand leave AC-3 for later.';
    const coder = scripted(() => (repo.commit('a.txt', 'a'), done()));
    await runLoop(
      options(repo, { instructions, sessions: { coder, reviewer: scripted(() => clean), cold: scripted(() => clean) } })
    );
    expect(coder.briefs[0]).toContain(instructions);
  });

  it('briefs round 1 with feedback that was waiting when the loop started', async () => {
    const repo = makeRepo();
    const coder = scripted(() => (repo.commit('a.txt', 'a'), done()));
    await runLoop(
      options(repo, {
        feedback: queue('rename the setting to foam.links.previous'),
        sessions: { coder, reviewer: scripted(() => clean), cold: scripted(() => clean) },
      })
    );
    expect(coder.briefs[0]).toContain('rename the setting to foam.links.previous');
  });
});

describe('rounds', () => {
  it('sends a red suite straight back to the coder, without a review', async () => {
    const repo = makeRepo();
    const gate = `node -e "if (!require('fs').existsSync('fixed.txt')) { console.log('suite exploded'); process.exit(1) }"`;
    const coder = scripted(
      () => (repo.commit('a.txt', 'a'), done()),
      () => (repo.commit('fixed.txt', 'ok'), done())
    );
    const reviewer = scripted(() => clean);
    const result = await runLoop(options(repo, { gate: [gate], sessions: { coder, reviewer, cold: scripted(() => clean) } }));

    expect(coder.briefs[1]).toContain('suite exploded');
    expect(reviewer.calls).toBe(1);
    expect(result.rounds).toBe(2);
  });

  it('counts a red round toward the cap', async () => {
    const repo = makeRepo();
    const reviewer = scripted();
    const result = await runLoop(
      options(repo, {
        rounds: 1,
        gate: [FAIL],
        sessions: { coder: scripted(() => (repo.commit('a.txt', 'a'), done())), reviewer, cold: scripted(() => clean) },
      })
    );
    expect(reviewer.calls).toBe(0);
    expect(result.stopped).toMatch(/round cap/);
    expect(result.findings.map(f => f.source)).toEqual(['suite']);
  });

  it('adds feedback typed during a round to the next round, and only once', async () => {
    const repo = makeRepo();
    const feedback = queue();
    const coder = scripted(
      () => (feedback.push('use the existing date helper'), repo.commit('a.txt', 'a'), done()),
      () => (repo.commit('b.txt', 'b'), done()),
      () => (repo.commit('c.txt', 'c'), done())
    );
    const reviewer = scripted(
      () => mustFix('one'),
      () => mustFix('two'),
      () => clean
    );
    await runLoop(options(repo, { feedback, sessions: { coder, reviewer, cold: scripted(() => clean) } }));

    expect(coder.briefs[1]).toContain('use the existing date helper');
    expect(coder.briefs[2]).not.toContain('use the existing date helper');
  });

  it('stops when the coder is blocked', async () => {
    const repo = makeRepo();
    const reviewer = scripted();
    const result = await runLoop(
      options(repo, {
        sessions: {
          coder: scripted(() => ({ blocked: true, summary: 'AC-2 contradicts AC-4', outcomes: [] })),
          reviewer,
          cold: scripted(),
        },
      })
    );
    expect(result.blocked).toBe(true);
    expect(result.stopped).toMatch(/blocked.*AC-2 contradicts AC-4/);
    expect(reviewer.calls).toBe(0);
  });

  it('stops when a round makes no commit', async () => {
    const repo = makeRepo();
    const result = await runLoop(
      options(repo, { sessions: { coder: scripted(() => done()), reviewer: scripted(), cold: scripted(() => clean) } })
    );
    expect(result.stopped).toMatch(/no commit/);
  });

  it('stops when the review has no MUST_FIX and no feedback is waiting', async () => {
    const repo = makeRepo();
    const reviewer = scripted(() => ({ findings: [{ path: 'a.txt', line: null, tier: 'SHOULD', finding: 'nicer name' }] }));
    const result = await runLoop(
      options(repo, {
        sessions: { coder: scripted(() => (repo.commit('a.txt', 'a'), done())), reviewer, cold: scripted(() => clean) },
      })
    );
    expect(result.rounds).toBe(1);
    expect(result.stopped).toMatch(/no MUST_FIX/);
  });

  it('keeps going after a clean review while feedback is waiting', async () => {
    const repo = makeRepo();
    const feedback = queue();
    const coder = scripted(
      () => (repo.commit('a.txt', 'a'), done()),
      () => (repo.commit('b.txt', 'b'), done())
    );
    const reviewer = scripted(
      () => (feedback.push('also cover leap years'), clean),
      () => clean
    );
    const result = await runLoop(options(repo, { feedback, sessions: { coder, reviewer, cold: scripted(() => clean) } }));

    expect(result.rounds).toBe(2);
    expect(coder.briefs[1]).toContain('also cover leap years');
  });

  it('stops at the round cap', async () => {
    const repo = makeRepo();
    const coder = scripted(
      () => (repo.commit('a.txt', 'a'), done()),
      () => (repo.commit('b.txt', 'b'), done())
    );
    const result = await runLoop(
      options(repo, {
        rounds: 2,
        sessions: { coder, reviewer: scripted(() => mustFix('one'), () => mustFix('two')), cold: scripted(() => clean) },
      })
    );
    expect(result.rounds).toBe(2);
    expect(result.stopped).toMatch(/round cap/);
  });

  it('lists feedback that no round got to as open findings', async () => {
    const repo = makeRepo();
    const feedback = queue();
    const cold = scripted(() => (feedback.push('one more thing'), clean));
    const result = await runLoop(
      options(repo, {
        feedback,
        sessions: { coder: scripted(() => (repo.commit('a.txt', 'a'), done())), reviewer: scripted(() => clean), cold },
      })
    );
    const open = result.findings.filter(f => !result.outcomes[f.id]);
    expect(open.map(f => f.finding)).toEqual(['one more thing']);
  });
});

describe('session output', () => {
  it('stops the run when the coder returns the wrong shape, naming the session', async () => {
    const repo = makeRepo();
    const run = runLoop(
      options(repo, {
        sessions: { coder: scripted(() => ({ blocked: 'no' })), reviewer: scripted(), cold: scripted() },
      })
    );
    await expect(run).rejects.toThrow(/round 1 coder/);
  });

  it('stops the run when a session fails, naming it', async () => {
    const repo = makeRepo();
    const coder = async () => {
      throw new Error('Claude Code process exited with code 1');
    };
    const run = runLoop(options(repo, { sessions: { coder, reviewer: scripted(), cold: scripted() } }));
    await expect(run).rejects.toThrow(LoopError);
    await expect(run).rejects.toThrow(/round 1 coder failed: Claude Code process exited with code 1/);
  });

  it('stops the run when the reviewer returns nothing, naming the session', async () => {
    const repo = makeRepo();
    const run = runLoop(
      options(repo, {
        sessions: {
          coder: scripted(() => (repo.commit('a.txt', 'a'), done())),
          reviewer: scripted(() => undefined),
          cold: scripted(),
        },
      })
    );
    await expect(run).rejects.toThrow(/round 1 reviewer/);
  });

  it("never reads a previous run's output in place of the current one", async () => {
    const repo = makeRepo();
    await runLoop(
      options(repo, {
        now: () => new Date('2026-09-23T10:00:00Z'),
        sessions: {
          coder: scripted(() => (repo.commit('a.txt', 'a'), done())),
          reviewer: scripted(() => clean),
          cold: scripted(() => clean),
        },
      })
    );
    const second = runLoop(
      options(repo, {
        now: () => new Date('2026-09-23T11:00:00Z'),
        sessions: { coder: scripted(() => 'not json at all'), reviewer: scripted(), cold: scripted() },
      })
    );
    await expect(second).rejects.toThrow(/round 1 coder/);
  });
});

describe('the run record', () => {
  it('keeps each run in its own directory, numbering rounds from 1', async () => {
    const repo = makeRepo();
    const run = (hour: string, file: string) =>
      runLoop(
        options(repo, {
          now: () => new Date(`2026-09-23T${hour}:00:00Z`),
          sessions: {
            coder: scripted(() => (repo.commit(file, file), done())),
            reviewer: scripted(() => clean),
            cold: scripted(() => clean),
          },
        })
      );

    const first = await run('10', 'a.txt');
    const firstCoder = readFileSync(path.join(first.runDir, 'round-1', 'coder.json'), 'utf8');
    const second = await run('11', 'b.txt');

    expect(path.dirname(first.runDir)).toBe(path.join(repo.root, '.agent-loop', 'demo'));
    expect(second.runDir).not.toBe(first.runDir);
    expect(readdirSync(path.join(second.runDir))).toContain('round-1');
    expect(existsSync(path.join(second.runDir, 'round-1', 'coder.json'))).toBe(true);
    expect(readFileSync(path.join(first.runDir, 'round-1', 'coder.json'), 'utf8')).toBe(firstCoder);
  });
});

describe('the cold pass', () => {
  it("reads the change with none of the loop's history, and reports only to the maintainer", async () => {
    const repo = makeRepo();
    const coder = scripted(
      () => (repo.commit('a.txt', 'a'), done()),
      () => (repo.commit('b.txt', 'b'), done([{ id: 'R1', outcome: 'fixed', reason: 'handled tabs' }]))
    );
    const reviewer = scripted(
      () => mustFix('the parser drops tabs'),
      () => clean
    );
    const cold = scripted(() => mustFix('a cold finding'));
    const result = await runLoop(options(repo, { sessions: { coder, reviewer, cold } }));

    expect(cold.briefs[0]).not.toContain('the parser drops tabs');
    expect(cold.briefs[0]).not.toContain('handled tabs');
    expect(cold.briefs[0]).toContain('specs/demo/spec.md');
    expect(result.cold?.map(f => f.finding)).toEqual(['a cold finding']);
    expect(coder.calls).toBe(2);
  });

  it('is skipped when the coder is blocked', async () => {
    const repo = makeRepo();
    const cold = scripted();
    const result = await runLoop(
      options(repo, {
        sessions: {
          coder: scripted(() => ({ blocked: true, summary: 'stuck', outcomes: [] })),
          reviewer: scripted(),
          cold,
        },
      })
    );
    expect(cold.calls).toBe(0);
    expect(result.cold).toBeNull();
  });
});
