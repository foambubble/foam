import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  AlwaysIncludeMatcher,
  bootstrap,
  createMarkdownParser,
  IDataStore,
  MarkdownResourceProvider,
  URI,
} from '@foam/core';
import { InMemoryDataStore } from '@foam/core/test';
import { FoamMcpServer } from './server';

/**
 * Full server lifecycle: bootstrap → register tools → connect transport →
 * client lists/calls tools → close. Distinct from the per-module tool tests
 * in tools/*.test.ts which exercise individual tools; this one verifies the
 * tool list + lifecycle as observable to a real MCP client.
 */
describe('FoamMcpServer lifecycle', () => {
  const buildHarness = async (readOnly = false) => {
    const rootUri = URI.file('/workspace');
    const dataStore = new InMemoryDataStore();
    dataStore.set(rootUri.joinPath('a.md'), '# A\n\n[[b]]');
    dataStore.set(rootUri.joinPath('b.md'), '# B');

    const parser = createMarkdownParser();
    const provider = new MarkdownResourceProvider(
      dataStore as IDataStore,
      parser,
      ['.md']
    );
    const foam = await bootstrap(
      [rootUri],
      new AlwaysIncludeMatcher(),
      undefined,
      dataStore as IDataStore,
      parser,
      [provider],
      '.md',
      'off'
    );

    const server = new FoamMcpServer({
      foam,
      dataStore: dataStore as IDataStore,
      rootUri,
      readOnly,
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: 'test', version: '0.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    return {
      client,
      server,
      close: async () => {
        await client.close();
        await server.close();
      },
    };
  };

  it('exposes the expected catalogue of tools after connect', async () => {
    const h = await buildHarness();
    try {
      const list = await h.client.listTools();
      const names = list.tools.map(t => t.name).sort();
      // Spot-check one tool from each module rather than asserting the
      // entire list verbatim — that would couple this test to every
      // future tool addition. Module coverage is what we care about here.
      expect(names).toEqual(
        expect.arrayContaining([
          // resources
          'list_resources',
          'get_resource',
          'read_resource',
          'create_resource',
          'update_resource',
          'delete_resource',
          'move_resource',
          // graph
          'get_connections',
          'get_orphans',
          'get_deadends',
          'get_placeholders',
          'traverse_graph',
          'get_graph_summary',
          'get_workspace_info',
          // tags
          'list_tags',
          'search_by_tag',
          'add_tags',
          'remove_tags',
          'rename_tag',
          // search
          'search_resources',
          'search_by_property',
          // structure
          'get_outline',
        ])
      );
    } finally {
      await h.close();
    }
  });

  it('every registered tool advertises a description', async () => {
    const h = await buildHarness();
    try {
      const list = await h.client.listTools();
      for (const tool of list.tools) {
        expect(tool.description, `tool ${tool.name} missing description`)
          .toBeDefined();
      }
    } finally {
      await h.close();
    }
  });

  it('readOnly mode does not register write tools', async () => {
    const h = await buildHarness(true);
    try {
      const list = await h.client.listTools();
      const names = list.tools.map(t => t.name);
      const writeTools = [
        'create_resource',
        'update_resource',
        'delete_resource',
        'move_resource',
        'add_tags',
        'remove_tags',
        'rename_tag',
      ];
      for (const writer of writeTools) {
        expect(names).not.toContain(writer);
      }
      // Read tools are still there.
      expect(names).toContain('list_resources');
      expect(names).toContain('list_tags');
    } finally {
      await h.close();
    }
  });

  it('advertises read-only mode in initialize.instructions and get_workspace_info', async () => {
    const h = await buildHarness(true);
    try {
      const instructions = h.client.getInstructions();
      expect(instructions).toContain('read-only');

      const result = (await h.client.callTool({
        name: 'get_workspace_info',
        arguments: {},
      })) as { content: Array<{ text: string }> };
      const info = JSON.parse(result.content[0].text);
      expect(info.read_only).toBe(true);
    } finally {
      await h.close();
    }
  });

  it('non-readOnly mode reports read_only=false and no instructions', async () => {
    const h = await buildHarness(false);
    try {
      // SDK returns undefined when no instructions were set on the server.
      expect(h.client.getInstructions()).toBeUndefined();
      const result = (await h.client.callTool({
        name: 'get_workspace_info',
        arguments: {},
      })) as { content: Array<{ text: string }> };
      const info = JSON.parse(result.content[0].text);
      expect(info.read_only).toBe(false);
    } finally {
      await h.close();
    }
  });

  it('close() stops the transport so subsequent calls reject', async () => {
    const h = await buildHarness();
    await h.close();
    await expect(h.client.listTools()).rejects.toThrow();
  });
});
