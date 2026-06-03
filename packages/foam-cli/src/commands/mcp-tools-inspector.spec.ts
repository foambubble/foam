/**
 * Wire-format integration tests for `foam mcp`, driven through the
 * official MCP Inspector CLI. Each tool is exercised as a real MCP client
 * would invoke it; the assertions cover the JSON shape that goes over
 * stdio (not just our internal data shapes).
 *
 * This is the layer of testing that catches issues the in-process
 * `tools/*.test.ts` cannot — for example, URIs that are constructed
 * relative to `process.cwd()` rather than the workspace root only show
 * up when the CLI is actually spawned.
 *
 * One Inspector invocation per tool call (~1–2s each), so we use a
 * single shared fixture workspace per `describe` to keep total runtime
 * sane.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { createTmpDir } from '../test/test-utils';

const CLI_PATH = path.resolve(__dirname, '../../out/index.js');
const INSPECTOR_PATH = path.resolve(
  __dirname,
  '../../../../node_modules/@modelcontextprotocol/inspector/cli/build/cli.js'
);

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}

/**
 * Invokes the Inspector CLI to call a tool on the built `foam mcp` server.
 * Returns the raw `CallToolResult` JSON. Throws if Inspector exits non-zero
 * for transport-level reasons (the `isError` flag for tool-level errors is
 * surfaced as a normal return value).
 */
function callTool(
  workspaceDir: string,
  toolName: string,
  toolArgs: Record<string, string> = {}
): ToolResult {
  const args = [
    INSPECTOR_PATH,
    '--cli',
    process.execPath,
    CLI_PATH,
    'mcp',
    '--workspace',
    workspaceDir,
    '--method',
    'tools/call',
    '--tool-name',
    toolName,
  ];
  for (const [k, v] of Object.entries(toolArgs)) {
    args.push('--tool-arg', `${k}=${v}`);
  }
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: 30000,
    // Disable telemetry: this spec spawns the real CLI binary, which would
    // otherwise POST to App Insights on every test run.
    env: { ...process.env, FOAM_TELEMETRY: '0' },
  });
  if (result.status !== 0) {
    throw new Error(
      `Inspector exited ${result.status} for ${toolName}\n` +
        `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return JSON.parse(result.stdout) as ToolResult;
}

/** Parses the JSON in the first text content. Throws on tool-level error. */
function parseJson<T>(result: ToolResult): T {
  if (result.isError) {
    throw new Error(`tool returned error: ${result.content[0]?.text}`);
  }
  const text = result.content[0]?.text;
  if (!text) throw new Error('no text content');
  return JSON.parse(text) as T;
}

describe('foam mcp tools (Inspector integration)', () => {
  let workspaceDir: string;
  let cleanup: () => void;

  beforeAll(() => {
    const tmp = createTmpDir(
      {
        'project-plan.md':
          '---\ntitle: Project Plan\ntags: [project, active]\n---\n# Project Plan\n\nLinks to [[meeting-notes]] and [[ideas]].\n\n## Goals\n\n- Build MCP\n',
        'meeting-notes.md':
          '---\ntitle: Meeting Notes\ntags: [meeting]\n---\n# Meeting Notes\n\nDiscussed [[project-plan]].\n\n## Action items\n\n- [ ] follow up\n',
        'ideas.md':
          '---\ntitle: Ideas\n---\n# Ideas\n\nFrom [[project-plan]]. References [[missing-note]].\n',
        'orphan.md': '# Orphan\n\nNo connections.\n',
      },
      'foam-mcp-inspector-'
    );
    workspaceDir = tmp.rootDir;
    cleanup = tmp.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  describe('graph tools', () => {
    it('get_workspace_info reports the right counts and read_only=false', () => {
      const info = parseJson<{
        note_count: number;
        orphan_count: number;
        placeholder_count: number;
        connection_count: number;
        read_only: boolean;
      }>(callTool(workspaceDir, 'get_workspace_info'));
      expect(info.note_count).toBe(4);
      expect(info.orphan_count).toBe(1);
      expect(info.placeholder_count).toBe(1);
      expect(info.connection_count).toBeGreaterThan(0);
      expect(info.read_only).toBe(false);
    });

    it('get_orphans returns the orphan note', () => {
      const orphans = parseJson<Array<{ uri: string }>>(
        callTool(workspaceDir, 'get_orphans')
      );
      expect(orphans.map(o => o.uri)).toEqual(['orphan.md']);
    });

    it('get_placeholders emits a `placeholder:<id>` wire-format URI', () => {
      // Regression test: placeholder URIs are virtual — they don't point
      // at any real file. Earlier the serializer ran them through
      // `relativeTo(rootUri)` which (because the placeholder path has no
      // leading slash) produced `../../<cwd>/<id>`-style nonsense that
      // escaped the workspace root. The wire-format now uses the
      // dedicated `placeholder:` scheme to make the virtual nature
      // explicit and unambiguous.
      const placeholders = parseJson<
        Array<{ placeholder_id: string; uri: string }>
      >(callTool(workspaceDir, 'get_placeholders'));
      const missing = placeholders.find(
        p => p.placeholder_id === 'missing-note'
      );
      expect(missing).toBeDefined();
      expect(missing!.uri).toBe('placeholder:missing-note');
    });

    it('get_connections reports outgoing and incoming wikilinks', () => {
      const result = parseJson<{
        links: Array<{ uri: string }>;
        backlinks: Array<{ uri: string }>;
      }>(
        callTool(workspaceDir, 'get_connections', {
          uri: 'project-plan.md',
        })
      );
      expect(result.links.map(l => l.uri).sort()).toEqual([
        'ideas.md',
        'meeting-notes.md',
      ]);
      expect(result.backlinks.map(b => b.uri).sort()).toEqual([
        'ideas.md',
        'meeting-notes.md',
      ]);
    });

    it('traverse_graph walks both directions to the requested depth', () => {
      const result = parseJson<{
        nodes: Array<{ uri: string; distance: number }>;
      }>(
        callTool(workspaceDir, 'traverse_graph', {
          uri: 'project-plan.md',
          depth: '2',
          direction: 'both',
        })
      );
      const distances = Object.fromEntries(
        result.nodes.map(n => [n.uri, n.distance])
      );
      expect(distances['project-plan.md']).toBe(0);
      expect(distances['meeting-notes.md']).toBe(1);
      expect(distances['ideas.md']).toBe(1);
    });
  });

  describe('resource read tools', () => {
    it('list_resources returns workspace-relative URIs', () => {
      const items = parseJson<Array<{ uri: string }>>(
        callTool(workspaceDir, 'list_resources')
      );
      // All URIs should be workspace-relative — no leading slash, no
      // `..` traversal.
      for (const item of items) {
        expect(item.uri.startsWith('/'), `absolute uri: ${item.uri}`).toBe(
          false
        );
        expect(item.uri.startsWith('..'), `escaping uri: ${item.uri}`).toBe(
          false
        );
      }
    });

    it('get_resource includes outgoing/incoming link identifiers', () => {
      const detail = parseJson<{
        title: string;
        links?: { outgoing: string[]; incoming: string[] };
      }>(callTool(workspaceDir, 'get_resource', { uri: 'project-plan.md' }));
      expect(detail.title).toBe('Project Plan');
      expect(detail.links?.outgoing.sort()).toEqual(['ideas', 'meeting-notes']);
    });

    it('read_resource returns the raw markdown', () => {
      const result = parseJson<{ content: string }>(
        callTool(workspaceDir, 'read_resource', { uri: 'orphan.md' })
      );
      expect(result.content).toContain('# Orphan');
    });

    it('read_resource on a missing file returns a structured resource_not_found', () => {
      const raw = callTool(workspaceDir, 'read_resource', {
        uri: 'does-not-exist.md',
      });
      expect(raw.isError).toBe(true);
      const err = JSON.parse(raw.content[0].text!);
      expect(err.code).toBe('resource_not_found');
    });
  });

  describe('tag tools', () => {
    it('list_tags reports counts', () => {
      const tags = parseJson<Array<{ tag: string; count: number }>>(
        callTool(workspaceDir, 'list_tags')
      );
      expect(tags.find(t => t.tag === 'project')?.count).toBe(1);
    });

    it('search_by_tag returns notes with that tag', () => {
      const matches = parseJson<Array<{ uri: string }>>(
        callTool(workspaceDir, 'search_by_tag', { tag: 'project' })
      );
      expect(matches.map(m => m.uri)).toEqual(['project-plan.md']);
    });
  });

  describe('search tools', () => {
    it('search_resources matches by title substring', () => {
      const matches = parseJson<Array<{ uri: string }>>(
        callTool(workspaceDir, 'search_resources', { query: 'Meeting' })
      );
      expect(matches.map(m => m.uri)).toEqual(['meeting-notes.md']);
    });
  });

  describe('structure tools', () => {
    it('get_outline returns sections', () => {
      const outline = parseJson<{
        sections: Array<{ label: string; level: number }>;
      }>(callTool(workspaceDir, 'get_outline', { uri: 'project-plan.md' }));
      const labels = outline.sections.map(s => s.label);
      expect(labels).toContain('Project Plan');
      expect(labels).toContain('Goals');
    });
  });

  // Note: write tools (create/update/delete/move/add_tags/remove_tags/rename_tag)
  // mutate the shared fixture, so they would interfere with read-tool
  // expectations if run in the same describe. They're already covered by
  // the in-process tests in foam-mcp/src/tools/resources.test.ts and
  // tags.test.ts; the fast-feedback Inspector smoke for writes is in
  // mcp.spec.ts (`respects --read-only`). If we want full Inspector
  // coverage of writes too, we'd build a fresh fixture per write test.
});
