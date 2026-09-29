/* @unit-ready */
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import {
  Foam,
  FoamGraph,
  FoamWorkspace,
  createMarkdownParser,
} from '@foam/core';
import activate from './index';
import { CONFIG_EMBED_NOTE_TYPE } from './wikilink-embed';
import {
  createFile,
  deleteFile,
  withModifiedFoamConfiguration,
} from '../../../test/test-utils-vscode';

const parser = createMarkdownParser();
const MATH_NOTE = '# Formulas\n\nInline $x+1$.\n\n$$\nx^2\n$$\n\n#embed-math\n';

/**
 * Renders `source` through Foam's preview plugin, with `MATH_NOTE` in the
 * workspace. `source` itself holds no math, so any KaTeX output comes from
 * the renderers Foam builds for embedded content.
 */
async function renderPreview(source: string): Promise<string> {
  const note = await createFile(MATH_NOTE, ['embed-math', 'formulas.md']);
  const workspace = new FoamWorkspace().set(
    parser.parse(note.uri, note.content)
  );
  const graph = FoamGraph.fromWorkspace(workspace);
  const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
  try {
    const preview = await activate(
      context,
      Promise.resolve({ workspace, graph, services: { parser } } as Foam)
    );
    let html: string;
    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        html = preview
          .extendMarkdownIt(MarkdownIt({ html: true }))
          .render(source);
      }
    );
    return html;
  } finally {
    context.subscriptions.forEach(d => d.dispose());
    graph.dispose();
    await deleteFile(note);
  }
}

describe('Math in embedded notes', () => {
  // The preview activates every markdown-it plugin extension before it
  // renders anything; do the same here.
  beforeAll(async () => {
    await vscode.extensions.getExtension('vscode.markdown-math')?.activate();
  });

  it('renders inline and display math from an embedded note', async () => {
    const html = await renderPreview('![[formulas]]');
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('katex-error');
    expect(html).not.toContain('$x+1$');
  });

  it('renders math in foam-query body cells', async () => {
    const html = await renderPreview(
      '```foam-query\nfilter: "#embed-math"\nselect: [body]\n```'
    );
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('$x+1$');
  });

  it('renders the embed with math as source when the math extension is unavailable', async () => {
    const spy = vi
      .spyOn(vscode.extensions, 'getExtension')
      .mockReturnValue(undefined);
    try {
      const html = await renderPreview('![[formulas]]');
      expect(html).toContain('$x+1$');
      expect(html).not.toContain('class="katex"');
    } finally {
      spy.mockRestore();
    }
  });
});
