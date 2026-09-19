/* @unit-ready */
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { Foam, URI, FoamGraph, createMarkdownParser } from '@foam/core';
import activate from './index';
import { createTestWorkspace } from '../../../test/test-utils';
import { createFile, deleteFile } from '../../../test/test-utils-vscode';

describe('Preview math extension adapter', () => {
  async function withExtension(
    api: unknown,
    check: (preview: Awaited<ReturnType<typeof activate>>, calls: any) => void,
    reject = false
  ) {
    const extensionActivate = vi.fn(async () => {
      if (reject) throw new Error('Math activation failed');
      return api;
    });
    const original = vscode.extensions.getExtension.bind(vscode.extensions);
    const spy = vi
      .spyOn(vscode.extensions, 'getExtension')
      .mockImplementation(id => {
        if (id !== 'vscode.markdown-math') return original(id);
        return api === undefined
          ? undefined
          : ({ activate: extensionActivate } as any);
      });
    const config = vscode.workspace.getConfiguration();
    const previousStyle = config.get('foam.preview.embedNoteType');
    await config.update('foam.preview.embedNoteType', 'full-card');
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([
      URI.file(vscode.workspace.workspaceFolders[0].uri.fsPath),
    ]);
    const graph = FoamGraph.fromWorkspace(workspace, false);
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    const file = await createFile('Embedded text', [
      'math-adapter',
      'Child.md',
    ]);
    workspace.set(parser.parse(file.uri, file.content));
    try {
      const preview = await activate(
        context,
        Promise.resolve({ workspace, graph, services: { parser } } as Foam)
      );
      check(preview, extensionActivate);
    } finally {
      spy.mockRestore();
      await config.update('foam.preview.embedNoteType', previousStyle);
      context.subscriptions.forEach(d => d.dispose());
      graph.dispose();
      await deleteFile(file);
    }
  }

  it('activates once and installs only on fresh inner renderers, including query cells', async () => {
    const install = vi.fn((md: MarkdownIt) => {
      md.renderer.rules.text = (tokens, idx) =>
        `[math-ready:${tokens[idx].content}]`;
      return md;
    });
    await withExtension({ extendMarkdownIt: install }, (preview, calls) => {
      expect(calls).toHaveBeenCalledTimes(1);
      const outer = MarkdownIt({ html: true });
      preview.extendMarkdownIt(outer);
      expect(install).not.toHaveBeenCalled();
      const first = outer.render('![[Child]]');
      expect(first).toContain('[math-ready:Embedded text]');
      expect(install).toHaveBeenCalledTimes(1);
      outer.render('![[Child]]');
      expect(install).toHaveBeenCalledTimes(2);
      expect(install.mock.calls[0][0]).not.toBe(install.mock.calls[1][0]);
      expect(
        outer.render(
          '```foam-query\nfilter:\n  path: math-adapter/Child\nselect: [body]\n```'
        )
      ).toContain('[math-ready:Embedded text]');
      expect(install.mock.calls.every(([md]) => md !== outer)).toBe(true);
      expect(calls).toHaveBeenCalledTimes(1);
    });
  });

  for (const [name, api, reject] of [
    ['absent extension', undefined, false],
    ['missing export', {}, false],
    ['invalid export', { extendMarkdownIt: true }, false],
    ['activation failure', {}, true],
  ] as const) {
    it(`keeps ordinary embeds available on ${name}`, async () => {
      await withExtension(
        api,
        preview => {
          const md = preview.extendMarkdownIt(MarkdownIt({ html: true }));
          expect(md.render('![[Child]]')).toContain('Embedded text');
        },
        reject
      );
    });
  }
});
