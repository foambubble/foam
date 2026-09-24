import { createMarkdownParser, FoamGraph } from '@foam/core';
import { createTestWorkspace } from '@foam/core/test';
import { createFoamMarkdownIt } from './foam-markdown-it';

describe('createFoamMarkdownIt', () => {
  const source = 'Some text[^1].\n\n[^1]: The footnote.\n';

  const build = (footnotes?: boolean) => {
    const workspace = createTestWorkspace();
    return createFoamMarkdownIt({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
      parser: createMarkdownParser([]),
      linkResolver: () => ({}),
      getCurrentResource: () => null,
      footnotes,
    });
  };

  it('renders footnotes by default', () => {
    const html = build().render(source);
    expect(html).toContain('class="footnote-ref"');
    expect(html).toContain('class="footnotes"');
  });

  it('leaves footnote syntax alone when footnotes are disabled (#1705)', () => {
    const html = build(false).render(source);
    expect(html).not.toContain('class="footnote');
    expect(html).toContain('<p>Some text[^1].</p>');
  });
});
