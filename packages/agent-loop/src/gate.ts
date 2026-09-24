import { spawnSync } from 'node:child_process';

export type GateResult = { ok: true; log: string } | { ok: false; command: string; output: string; log: string };

/**
 * Runs each command in order through the shell, stopping at the first that
 * fails. `log` holds every command's combined output, in order.
 */
export function runGate(commands: string[], { cwd, env }: { cwd: string; env?: NodeJS.ProcessEnv }): GateResult {
  let log = '';
  for (const command of commands) {
    const result = spawnSync(command, {
      cwd,
      env,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`;
    log += `$ ${command}\n${output}\n`;
    if (result.status !== 0) return { ok: false, command, output, log };
  }
  return { ok: true, log };
}
