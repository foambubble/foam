import { InMemoryTelemetryReporter } from '@foam/core';
import { withMcpServer } from './test-setup';

const SEED = {
  'a.md': '# A\n\n[[b]]',
  'b.md': '# B',
};

describe('FoamMcpServer telemetry', () => {
  describe('mcp.session-started', () => {
    it('fires once after the client completes the initialize handshake', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async () => {
        const startedEvents = reporter.events.filter(e => e.name === 'mcp.session-started');
        expect(startedEvents).toHaveLength(1);
      });
    });

    it('carries mode=read-write by default and includes bucketed noteCount + attachmentCount', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async () => {
        const event = reporter.events.find(e => e.name === 'mcp.session-started');
        expect(event?.properties?.mode).toBe('read-write');
        // SEED has 2 notes → 1-10 bucket; no attachments → 0 bucket
        expect(event?.properties?.noteCount).toBe('1-10');
        expect(event?.properties?.attachmentCount).toBe('0');
      });
    });

    it('reports mode=read when readOnly is set', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter, readOnly: true }, async () => {
        const event = reporter.events.find(e => e.name === 'mcp.session-started');
        expect(event?.properties?.mode).toBe('read');
      });
    });

    it('carries the client name from the initialize handshake', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter, clientName: 'claude-desktop' }, async () => {
        const event = reporter.events.find(e => e.name === 'mcp.session-started');
        expect(event?.properties?.client).toBe('claude-desktop');
      });
    });
  });

  describe('mcp.session-with-tool', () => {
    it('does not fire until at least one tool is invoked', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async () => {
        const beforeAnyCall = reporter.events.filter(e => e.name === 'mcp.session-with-tool');
        expect(beforeAnyCall).toHaveLength(0);
      });
    });

    it('fires once on the first tool call and not again', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async ctx => {
        await ctx.callTool('list_resources');
        await ctx.callTool('list_resources');
        await ctx.callTool('list_tags');

        const events = reporter.events.filter(e => e.name === 'mcp.session-with-tool');
        expect(events).toHaveLength(1);
      });
    });
  });

  describe('mcp.tool-invoked', () => {
    it('fires once per tool call with tool, durationBucket, outcome', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async ctx => {
        await ctx.callTool('list_resources');

        const invoked = reporter.events.filter(e => e.name === 'mcp.tool-invoked');
        expect(invoked).toHaveLength(1);
        expect(invoked[0].properties).toMatchObject({
          tool: 'list_resources',
          outcome: 'success',
        });
        expect(invoked[0].properties?.durationBucket).toMatch(
          /^<10ms|<50ms|<500ms|<5s|<30s|30s\+$/
        );
      });
    });

    it('records outcome=error when the tool returns isError', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async ctx => {
        // get_resource without uri or identifier returns a structured error
        await ctx.callTool('get_resource');

        const invoked = reporter.events.find(
          e => e.name === 'mcp.tool-invoked' && e.properties?.tool === 'get_resource'
        );
        expect(invoked?.properties?.outcome).toBe('error');
      });
    });

    it('captures every tool call independently', async () => {
      const reporter = new InMemoryTelemetryReporter();
      await withMcpServer(SEED, { telemetry: reporter }, async ctx => {
        await ctx.callTool('list_resources');
        await ctx.callTool('list_tags');
        await ctx.callTool('get_workspace_info');

        const tools = reporter.events
          .filter(e => e.name === 'mcp.tool-invoked')
          .map(e => e.properties?.tool);
        expect(tools).toEqual(['list_resources', 'list_tags', 'get_workspace_info']);
      });
    });
  });

  describe('session isolation between server instances', () => {
    it('session-with-tool flag is per-server', async () => {
      const reporterA = new InMemoryTelemetryReporter();
      const reporterB = new InMemoryTelemetryReporter();

      await withMcpServer(SEED, { telemetry: reporterA }, async ctx => {
        await ctx.callTool('list_resources');
      });

      await withMcpServer(SEED, { telemetry: reporterB }, async ctx => {
        await ctx.callTool('list_resources');
      });

      expect(reporterA.events.filter(e => e.name === 'mcp.session-with-tool')).toHaveLength(1);
      expect(reporterB.events.filter(e => e.name === 'mcp.session-with-tool')).toHaveLength(1);
    });
  });

  describe('default reporter', () => {
    it('falls back to a noop when no telemetry is provided — server still works', async () => {
      // No telemetry option → noop reporter. We just verify the server
      // operates normally and nothing throws.
      await withMcpServer(SEED, async ctx => {
        const result = await ctx.callTool('list_resources');
        expect(result.isError).not.toBe(true);
      });
    });
  });
});
