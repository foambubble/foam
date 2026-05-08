/**
 * End-to-end test for `foam mcp`. Spawns the built CLI as a child process,
 * speaks JSON-RPC over its stdio, and asserts on the responses.
 *
 * Requires `yarn build` to have produced `out/index.js`. The harness in
 * `vitest.e2e.config.ts` runs the build before the test suite.
 *
 * This test exists as a `.spec.ts` (rather than `.test.ts`) because it
 * shells out to a built binary — it covers integration that the in-process
 * unit tests cannot: argv parsing, transport wiring, log routing to stderr,
 * watcher integration, and the `out/` bundle being self-contained.
 */
import { spawn, ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const CLI_PATH = path.resolve(__dirname, '../../out/index.js');
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CliHarness {
  client: Client;
  child: ChildProcess;
  vaultDir: string;
  stderr: string[];
  close: () => Promise<void>;
}

const buildVault = (files: Record<string, string>): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'foam-mcp-e2e-'));
  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
};

const startCli = async (
  vaultDir: string,
  extraArgs: string[] = []
): Promise<CliHarness> => {
  // StdioClientTransport handles spawning + plumbing stdio.
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI_PATH, 'mcp', '--workspace', vaultDir, ...extraArgs],
    stderr: 'pipe',
  });

  const stderr: string[] = [];
  const client = new Client(
    { name: 'foam-cli-e2e', version: '0.0.0' },
    { capabilities: {} }
  );
  await client.connect(transport);

  // The transport exposes the spawned process via `.stderr`.
  const stderrStream = (transport as unknown as { stderr?: NodeJS.ReadableStream })
    .stderr;
  stderrStream?.on('data', (chunk: Buffer) => {
    stderr.push(chunk.toString('utf8'));
  });

  return {
    client,
    child: (transport as unknown as { _process: ChildProcess })._process,
    vaultDir,
    stderr,
    close: async () => {
      await client.close();
    },
  };
};

describe('foam mcp (CLI e2e)', () => {
  it('lists tools and calls list_resources against a real vault', async () => {
    const vault = buildVault({
      'a.md': '# Note A\n\nLinks to [[b]].\n',
      'b.md': '# Note B\n',
    });
    const h = await startCli(vault);
    try {
      const list = await h.client.listTools();
      const names = list.tools.map(t => t.name);
      expect(names).toContain('list_resources');
      expect(names).toContain('get_workspace_info');

      const result = (await h.client.callTool({
        name: 'list_resources',
        arguments: {},
      })) as { content: Array<{ text: string }> };
      const items = JSON.parse(result.content[0].text) as Array<{ uri: string }>;
      expect(items.map(i => i.uri).sort()).toEqual(['a.md', 'b.md']);
    } finally {
      await h.close();
      rmSync(vault, { recursive: true, force: true });
    }
  }, 30000);

  it('detects newly-created files via the watcher (long-running session)', async () => {
    const vault = buildVault({
      'existing.md': '# Existing\n',
    });
    const h = await startCli(vault);
    try {
      const before = (await h.client.callTool({
        name: 'get_workspace_info',
        arguments: {},
      })) as { content: Array<{ text: string }> };
      expect(JSON.parse(before.content[0].text).note_count).toBe(1);

      // Add a file mid-session; chokidar should pick it up and the
      // graph should reflect it on the next tool call.
      writeFileSync(path.join(vault, 'fresh.md'), '# Fresh\n');

      // Wait for the watcher debounce (100ms) plus chokidar's
      // awaitWriteFinish (50ms) plus filesystem latency. Poll up to 3s
      // rather than guessing one fixed delay.
      let after: { note_count: number } | null = null;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        await wait(150);
        const result = (await h.client.callTool({
          name: 'get_workspace_info',
          arguments: {},
        })) as { content: Array<{ text: string }> };
        const parsed = JSON.parse(result.content[0].text);
        if (parsed.note_count === 2) {
          after = parsed;
          break;
        }
      }
      expect(after?.note_count).toBe(2);
    } finally {
      await h.close();
      rmSync(vault, { recursive: true, force: true });
    }
  }, 30000);

  it('routes its own logs to stderr (stdout reserved for the MCP transport)', async () => {
    const vault = buildVault({ 'a.md': '# A\n' });
    const h = await startCli(vault);
    try {
      // Round-trip a request to be sure the server printed startup logs.
      await h.client.listTools();
      // Give the stderr stream a beat to flush.
      await wait(100);
      const combinedStderr = h.stderr.join('');
      expect(combinedStderr).toContain('[foam-mcp]');
      expect(combinedStderr).toContain('Loading workspace');
    } finally {
      await h.close();
      rmSync(vault, { recursive: true, force: true });
    }
  }, 30000);

  it('respects --read-only by skipping write tools entirely', async () => {
    const vault = buildVault({ 'a.md': '# A\n' });
    const h = await startCli(vault, ['--read-only']);
    try {
      const list = await h.client.listTools();
      const names = list.tools.map(t => t.name);
      expect(names).not.toContain('update_resource');
      expect(names).not.toContain('delete_resource');
      // Read tools still present.
      expect(names).toContain('list_resources');

      // The mode is advertised in initialize.instructions and via
      // get_workspace_info.read_only.
      expect(h.client.getInstructions()).toContain('read-only');
      const info = (await h.client.callTool({
        name: 'get_workspace_info',
        arguments: {},
      })) as { content: Array<{ text: string }> };
      expect(JSON.parse(info.content[0].text).read_only).toBe(true);
    } finally {
      await h.close();
      rmSync(vault, { recursive: true, force: true });
    }
  }, 30000);
});
