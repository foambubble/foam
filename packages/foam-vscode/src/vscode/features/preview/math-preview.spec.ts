import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { Foam, URI, FoamGraph, createMarkdownParser } from '@foam/core';
import activate from './index';
import { createTestWorkspace } from '../../../test/test-utils';
import { createFile, deleteFile } from '../../../test/test-utils-vscode';

// This spec deliberately runs only in the real VS Code extension host.
// Keep fixtures independent of frontmatter handling (a separate fix).
describe('Math in the VS Code preview', () => {
  async function withPreview(
    check: (
      render: (source: string, hostFirst?: boolean) => string
    ) => Promise<void> | void
  ) {
    const math = await vscode.extensions
      .getExtension('vscode.markdown-math')
      ?.activate();
    expect(typeof math?.extendMarkdownIt).toBe('function');
    const sources = {
      Child:
        '# Child\n\nInline $x+1$.\n\n$$\nx^2\n$$\n\n## Section\n\nSection $y$ ^formula\n',
      Parent: '![[Child]]',
      Outer: '![[Parent]]',
      Macro: '$\\RR$\n',
      Define: '$\\gdef\\local{abc}\\local$',
      Use: '$\\local$',
      Cycle: '![[Cycle]]',
      Self: '# Self\n\n![[#Section]]\n\n## Section\n\nSelf $z$',
    };
    const files = [];
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([
      URI.file(vscode.workspace.workspaceFolders[0].uri.fsPath),
    ]);
    const graph = FoamGraph.fromWorkspace(workspace, false);
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    try {
      for (const [name, content] of Object.entries(sources)) {
        const file = await createFile(content, ['preview-math', name + '.md']);
        files.push(file);
        workspace.set(parser.parse(file.uri, content));
      }
      const preview = await activate(
        context,
        Promise.resolve({ workspace, graph, services: { parser } } as Foam)
      );
      await check((source, hostFirst = true) => {
        const md = MarkdownIt({ html: true });
        if (hostFirst) math.extendMarkdownIt(md);
        preview.extendMarkdownIt(md);
        if (!hostFirst) math.extendMarkdownIt(md);
        return md.render(source);
      });
    } finally {
      context.subscriptions.forEach(d => d.dispose());
      graph.dispose();
      for (const file of files) await deleteFile(file);
    }
  }

  it('renders inline/display math in embeds, fragments, nested embeds and query cells in either plugin order', async () => {
    const config = vscode.workspace.getConfiguration('markdown');
    const previous = config.inspect('math.enabled').workspaceValue;
    await config.update(
      'math.enabled',
      true,
      vscode.ConfigurationTarget.Workspace
    );
    try {
      await withPreview(render => {
        for (const hostFirst of [true, false]) {
          for (const source of [
            '![[Child]]',
            'inline![[Child]]',
            '![[Outer]]',
          ]) {
            const html = render(source, hostFirst);
            expect(html).toContain('class="katex"');
            expect(html).toContain('katex-display');
            expect(html).not.toContain('katex-error');
          }
          for (const source of [
            '![[Child#Section]]',
            '![[Child#^formula]]',
            '![[Self]]',
            '```foam-query\nfilter:\n  path: preview-math/Child\nselect: [body]\n```',
          ]) {
            const html = render(source, hostFirst);
            expect(html).toContain('class="katex"');
            expect(html).not.toContain('katex-error');
          }
          expect(render('$x$', hostFirst).match(/class="katex"/g)).toHaveLength(
            1
          );
          expect(render('![[Cycle]]', hostFirst)).toContain(
            'Cyclic link detected'
          );
        }
      });
    } finally {
      await config.update(
        'math.enabled',
        previous,
        vscode.ConfigurationTarget.Workspace
      );
    }
  });

  it('respects math settings across renderer reloads and isolates render-local macros', async () => {
    const config = vscode.workspace.getConfiguration('markdown');
    const enabled = config.inspect('math.enabled').workspaceValue;
    const macros = config.inspect('math.macros').workspaceValue;
    try {
      await config.update(
        'math.enabled',
        true,
        vscode.ConfigurationTarget.Workspace
      );
      await config.update(
        'math.macros',
        { '\\RR': '\\mathbb{R}' },
        vscode.ConfigurationTarget.Workspace
      );
      await withPreview(async render => {
        expect(render('![[Macro]]')).not.toContain('katex-error');
        expect(render('![[Macro]]')).toContain('mathbb');
        expect(render('![[Define]]')).not.toContain('katex-error');
        expect(render('![[Use]]')).toContain('katex-error');
        expect(render('![[Define]]\n\n![[Use]]')).toContain('katex-error');
        await config.update(
          'math.macros',
          {},
          vscode.ConfigurationTarget.Workspace
        );
        expect(render('![[Macro]]')).toContain('katex-error');
        await config.update(
          'math.enabled',
          false,
          vscode.ConfigurationTarget.Workspace
        );
        expect(render('![[Child]]')).toContain('$x+1$');
        expect(render('![[Child]]')).not.toContain('class="katex"');
        await config.update(
          'math.enabled',
          true,
          vscode.ConfigurationTarget.Workspace
        );
        expect(render('![[Child]]')).toContain('class="katex"');
      });
    } finally {
      await config.update(
        'math.macros',
        macros,
        vscode.ConfigurationTarget.Workspace
      );
      await config.update(
        'math.enabled',
        enabled,
        vscode.ConfigurationTarget.Workspace
      );
    }
  });
});
