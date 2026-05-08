import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  AlwaysIncludeMatcher,
  bootstrap,
  createMarkdownParser,
  Foam,
  IDataStore,
  MarkdownResourceProvider,
  URI,
} from '@foam/core';
import { InMemoryDataStore } from '@foam/core/test';
import { FoamMcpServer } from '../src';

export interface TestHarness {
  client: Client;
  server: FoamMcpServer;
  foam: Foam;
  dataStore: InMemoryDataStore;
  rootUri: URI;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<{
    isError?: boolean;
    content: Array<{ type: string; text?: string }>;
  }>;
  /** Parses the JSON in the first text content of a tool response. */
  callToolJson: <T = unknown>(
    name: string,
    args?: Record<string, unknown>
  ) => Promise<T>;
  close: () => Promise<void>;
}

/**
 * Builds a fully-wired in-memory MCP server + client pair for testing tools.
 * Files in `seed` are written to the data store before `bootstrap()` so the
 * graph and tags are populated.
 */
export async function buildTestHarness(
  seed: Record<string, string>,
  opts: { rootPath?: string; readOnly?: boolean } = {}
): Promise<TestHarness> {
  const rootPath = opts.rootPath ?? '/workspace';
  const rootUri = URI.file(rootPath);
  const dataStore = new InMemoryDataStore();

  for (const [relative, content] of Object.entries(seed)) {
    const uri = rootUri.joinPath(relative);
    dataStore.set(uri, content);
  }

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
    rootUri,
    readOnly: opts.readOnly,
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client(
    { name: 'foam-mcp-test', version: '0.0.0' },
    { capabilities: {} }
  );
  await client.connect(clientTransport);

  const callTool = (name: string, args?: Record<string, unknown>) =>
    client.callTool({ name, arguments: args ?? {} }) as Promise<{
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    }>;

  const callToolJson = async <T = unknown>(
    name: string,
    args?: Record<string, unknown>
  ): Promise<T> => {
    const result = await callTool(name, args);
    if (result.isError) {
      throw new Error(
        `Tool ${name} returned error: ${result.content[0]?.text ?? '<no text>'}`
      );
    }
    const text = result.content[0]?.text;
    if (!text) throw new Error(`Tool ${name} returned no text content`);
    return JSON.parse(text) as T;
  };

  return {
    client,
    server,
    foam,
    dataStore,
    rootUri,
    callTool,
    callToolJson,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
