import { existsSync } from 'node:fs';
import path from 'node:path';

export class StartError extends Error {}

const SPEC_ROOTS = ['specs', 'specs.local'];

/**
 * The spec a branch works from: `<root>/<slug>/spec.md`, where the slug is the
 * branch name minus everything up to its first `/`. Tracked specs win.
 */
export function findSpec(root: string, branch: string): { slug: string; specDir: string } {
  const slug = branch.includes('/') ? branch.slice(branch.indexOf('/') + 1) : branch;
  const candidates = SPEC_ROOTS.map(base => `${base}/${slug}`);
  const specDir = candidates.find(dir => existsSync(path.join(root, dir, 'spec.md')));
  if (specDir) return { slug, specDir };

  throw new StartError(
    [
      `Branch ${branch} has no spec. Looked for ${candidates.map(dir => `${dir}/spec.md`).join(' and ')}.`,
      `Start one with /write-spec. Work without a spec is a plain Claude Code session, not a loop.`,
    ].join('\n')
  );
}
