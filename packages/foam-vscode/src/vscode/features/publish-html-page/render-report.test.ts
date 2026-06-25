import { FoamGraph, URI, createMarkdownParser } from '@foam/core';
import {
  createTestNote,
  createTestWorkspace,
} from '../../../test/test-utils';
import { renderReport } from './render-report';

/**
 * Returns the body of an `@media <feature>` CSS block from `html`. Counts
 * braces rather than using a non-greedy regex so a nested rule (e.g.
 * `:root { ... }` inside the @media) doesn't truncate the match early.
 */
function extractMediaBlock(html: string, feature: string): string | null {
  const idx = html.indexOf(`@media ${feature}`);
  if (idx === -1) return null;
  const braceStart = html.indexOf('{', idx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(braceStart + 1, i);
    }
  }
  return null;
}

function buildScenario() {
  const parser = createMarkdownParser();
  const ws = createTestWorkspace();
  // A links to B and C; B links back to A. D is in the workspace but
  // intentionally NOT included in the report.
  ws.set(
    createTestNote({
      uri: '/alpha.md',
      title: 'Alpha',
      links: [{ slug: 'beta' }, { slug: 'gamma' }, { slug: 'delta' }],
    })
  );
  ws.set(
    createTestNote({
      uri: '/beta.md',
      title: 'Beta',
      links: [{ slug: 'alpha' }],
    })
  );
  ws.set(createTestNote({ uri: '/gamma.md', title: 'Gamma' }));
  ws.set(createTestNote({ uri: '/delta.md', title: 'Delta' }));
  const graph = FoamGraph.fromWorkspace(ws);

  const content = new Map<string, string>([
    [
      ws.find('alpha')!.uri.toString(),
      '# Alpha\n\nThis links to [[beta]] and [[gamma]] and [[delta]].\n',
    ],
    [
      ws.find('beta')!.uri.toString(),
      '# Beta\n\nBack to [[alpha]].\n',
    ],
    [ws.find('gamma')!.uri.toString(), '# Gamma\n\nLeaf note.\n'],
  ]);

  return { ws, graph, parser, content };
}

describe('renderReport', () => {
  it('renders a table of contents listing every included note', async () => {
    const { ws, graph, parser, content } = buildScenario();
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [
        ws.find('alpha')!.uri,
        ws.find('beta')!.uri,
        ws.find('gamma')!.uri,
      ],
      noteContent: content,
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toContain('class="report-toc"');
    expect(html).toContain('>Alpha</a>');
    expect(html).toContain('>Beta</a>');
    expect(html).toContain('>Gamma</a>');
  });

  it('renders each included note as an addressable section', async () => {
    const { ws, graph, parser, content } = buildScenario();
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [
        ws.find('alpha')!.uri,
        ws.find('beta')!.uri,
        ws.find('gamma')!.uri,
      ],
      noteContent: content,
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toMatch(/<section id="note-[^"]*alpha[^"]*"/);
    expect(html).toMatch(/<section id="note-[^"]*beta[^"]*"/);
    expect(html).toMatch(/<section id="note-[^"]*gamma[^"]*"/);
  });

  it('rewrites wikilinks to included notes as intra-document anchors', async () => {
    const { ws, graph, parser, content } = buildScenario();
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [
        ws.find('alpha')!.uri,
        ws.find('beta')!.uri,
        ws.find('gamma')!.uri,
      ],
      noteContent: content,
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // alpha → beta should be an in-document anchor
    expect(html).toMatch(/href=["']#note-[^"']*beta[^"']*["']/);
    // alpha → gamma should be an in-document anchor
    expect(html).toMatch(/href=["']#note-[^"']*gamma[^"']*["']/);
  });

  it('drops link styling for wikilinks to notes not in the report', async () => {
    const { ws, graph, parser, content } = buildScenario();
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [
        ws.find('alpha')!.uri,
        ws.find('beta')!.uri,
        ws.find('gamma')!.uri,
      ],
      noteContent: content,
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // delta is in the workspace but excluded — no anchor at all for it.
    expect(html).not.toMatch(/href='[^']*delta[^']*'/);
    // The visible text "Delta" should still appear since wikilinks render
    // their label as plain text when excluded.
    expect(html).toContain('Delta');
  });

  it('includes a Backlinks section listing in-report backlinks', async () => {
    const { ws, graph, parser, content } = buildScenario();
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [
        ws.find('alpha')!.uri,
        ws.find('beta')!.uri,
        ws.find('gamma')!.uri,
      ],
      noteContent: content,
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Alpha has a backlink from Beta — both are in the report
    expect(html).toMatch(
      /id="note-[^"]*alpha[^"]*"[\s\S]*?Backlinks[\s\S]*?Beta/
    );
  });

  it('omits the Backlinks section when a note has no in-report backlinks', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    // Two unconnected notes — no backlinks at all.
    ws.set(createTestNote({ uri: '/one.md', title: 'One' }));
    ws.set(createTestNote({ uri: '/two.md', title: 'Two' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('one')!.uri, ws.find('two')!.uri],
      noteContent: new Map([
        [ws.find('one')!.uri.toString(), '# One\n\nText.\n'],
        [ws.find('two')!.uri.toString(), '# Two\n\nText.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // No backlinks section markup anywhere in the document. We assert on the
    // structural elements rather than the word "Backlinks" — the CSS file
    // names the class and would otherwise produce a false positive.
    expect(html).not.toContain('<section class="backlinks"');
    expect(html).not.toContain('<h3>Backlinks</h3>');
  });

  it('embeds a preview <template> per included note', async () => {
    const { ws, graph, parser, content } = buildScenario();
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: content,
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toMatch(/<template[^>]*data-preview-for="[^"]*alpha[^"]*"/);
    expect(html).toMatch(/<template[^>]*data-preview-for="[^"]*beta[^"]*"/);
  });

  it('inlines local images referenced by included notes as data URIs', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    const noteUri = URI.file('/alpha.md');
    const content = '# Alpha\n\n![logo](logo.png)\n';
    // Parse the content so `resource.links` contains the actual image
    // reference — the renderer walks parsed links rather than scanning raw
    // markdown, so a hand-rolled `createTestNote` (no links) wouldn't trigger
    // inlining even though it would in production.
    ws.set(parser.parse(noteUri, content));
    ws.set(
      createTestNote({ uri: '/logo.png', type: 'image' })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [noteUri],
      noteContent: new Map([[noteUri.toString(), content]]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    expect(html).toContain('src="data:image/png;base64,');
  });

  it('inlines images inside an embedded note so embeds remain self-contained', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    const hostUri = URI.file('/host.md');
    const embeddedUri = URI.file('/embedded.md');
    // Host embeds the other note via `![[embedded]]`; embedded note
    // references an image.
    const hostContent = '# Host\n\nSee below.\n\n![[embedded]]\n';
    const embeddedContent = '# Embedded\n\n![logo](logo.png)\n';
    ws.set(parser.parse(hostUri, hostContent));
    ws.set(parser.parse(embeddedUri, embeddedContent));
    ws.set(createTestNote({ uri: '/logo.png', type: 'image' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [hostUri, embeddedUri],
      noteContent: new Map([
        [hostUri.toString(), hostContent],
        [embeddedUri.toString(), embeddedContent],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    // The image must appear as a data URI at least twice — once in the
    // embedded note's own section (rendered through the OUTER md, which
    // always had the inliner), and once inside the EMBED that wikilink-embed
    // expands in the host's section (rendered through an INNER md spawned
    const dataUriOccurrences = html.split('src="data:image/png;base64,').length - 1;
    expect(dataUriOccurrences).toBeGreaterThanOrEqual(2);
    // And the raw filename must not survive anywhere in the live document
    const articleMatch = html.match(/<article class="report">[\s\S]*?<\/article>/);
    expect(articleMatch).not.toBeNull();
    expect(articleMatch![0]).not.toContain('src="logo.png"');
  });

  it('reads each unique attachment URI once, inlines under every raw target that referenced it', async () => {
    // Same physical attachment URI referenced from two notes via different
    // raw targets (`logo.png` vs `./logo.png`). The inliner should:
    //   - issue exactly one read for the URI (no per-ref read), and
    //   - register the data URI under BOTH raw targets so each note's
    //     render call hits the inline-src map.
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    const aUri = URI.file('/a.md');
    const bUri = URI.file('/b.md');
    const aContent = '# A\n\n![pic](logo.png)\n';
    const bContent = '# B\n\n![pic](./logo.png)\n';
    ws.set(parser.parse(aUri, aContent));
    ws.set(parser.parse(bUri, bContent));
    ws.set(createTestNote({ uri: '/logo.png', type: 'image' }));
    const graph = FoamGraph.fromWorkspace(ws);
    let reads = 0;
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [aUri, bUri],
      noteContent: new Map([
        [aUri.toString(), aContent],
        [bUri.toString(), bContent],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => {
        reads++;
        return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      },
    });
    // One read for the shared URI, not one per reference.
    expect(reads).toBe(1);
    // Both notes' rendered sections contain the data URI.
    const dataUriOccurrences =
      html.split('src="data:image/png;base64,').length - 1;
    expect(dataUriOccurrences).toBeGreaterThanOrEqual(2);
  });

  it('does not try to read an attachment shown only as a markdown example inside a code fence', async () => {
    // Regression: the old regex-based attachment scanner matched
    // `![alt](src)` anywhere in the raw markdown, including inside fenced
    // code blocks where the syntax is shown as an example. The parser-driven
    // walk skips code-fence content (no AST link node is emitted), so we
    // assert here that no read attempt happens.
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    const noteUri = URI.file('/alpha.md');
    const content =
      '# Alpha\n\nHere is how you write a markdown image:\n\n' +
      '```\n![logo](nonexistent.png)\n```\n';
    ws.set(parser.parse(noteUri, content));
    const graph = FoamGraph.fromWorkspace(ws);
    const reads: URI[] = [];
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [noteUri],
      noteContent: new Map([[noteUri.toString(), content]]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async uri => {
        reads.push(uri);
        return null;
      },
    });
    expect(reads).toEqual([]);
    // The example shows the original markdown inside <code>, untouched.
    expect(html).toContain('nonexistent.png');
    // The only data-URI in the output is the favicon (image/svg+xml); the
    // PNG that markdown source mentioned must not have been read or
    // inlined.
    expect(html).not.toContain('data:image/png');
  });

  it('emits per-note section anchors so [[note#section]] resolves intra-document', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(
      createTestNote({
        uri: '/alpha.md',
        title: 'Alpha',
        links: [{ slug: 'beta' }],
      })
    );
    ws.set(
      createTestNote({
        uri: '/beta.md',
        title: 'Beta',
        sections: ['Intro'],
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nJump to [[beta#Intro]].\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\n## Intro\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // The wikilink to beta#Intro is rewritten to the scoped section anchor
    expect(html).toMatch(/href=["']#note-[^"']*beta[^"']*--intro["']/);
    // The corresponding heading in Beta's section gets the same id stamped on it
    expect(html).toMatch(/<h2 id="note-[^"]*beta[^"]*--intro"/);
  });

  it('scopes section anchors per note so headings with the same text do not collide', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/one.md', title: 'One' }));
    ws.set(createTestNote({ uri: '/two.md', title: 'Two' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('one')!.uri, ws.find('two')!.uri],
      noteContent: new Map([
        [
          ws.find('one')!.uri.toString(),
          '# One\n\n## Overview\n\nFirst body.\n',
        ],
        [
          ws.find('two')!.uri.toString(),
          '# Two\n\n## Overview\n\nSecond body.\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Strip the preview templates so we only count IDs in the live document.
    const liveHtml = html.replace(
      /<div class="report-previews"[\s\S]*?<\/div>\s*<div id="report-hover-preview"/,
      '<div id="report-hover-preview"'
    );
    const ids = Array.from(liveHtml.matchAll(/<h2 id="([^"]+)"/g)).map(
      m => m[1]
    );
    const overviewIds = ids.filter(id => id.endsWith('--overview'));
    expect(overviewIds).toHaveLength(2);
    expect(overviewIds[0]).not.toBe(overviewIds[1]);
  });

  it('rewrites foam-query result links to intra-document anchors for included notes', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(
      createTestNote({
        uri: '/alpha.md',
        title: 'Alpha',
        tags: ['featured'],
      })
    );
    ws.set(
      createTestNote({
        uri: '/beta.md',
        title: 'Beta',
        tags: ['featured'],
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\n```foam-query\nfilter: "#featured"\nselect: title\n```\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // The query result links should be rewritten to intra-document anchors,
    // not left as raw workspace paths.
    expect(html).not.toMatch(/href=['"]\/?alpha\.md['"]/);
    expect(html).not.toMatch(/href=['"]\/?beta\.md['"]/);
    expect(html).toMatch(/href=['"]#note-[^'"]*alpha[^'"]*['"]/);
    expect(html).toMatch(/href=['"]#note-[^'"]*beta[^'"]*['"]/);
  });

  it('strips foam-query result links for notes not in the report set', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(
      createTestNote({
        uri: '/alpha.md',
        title: 'Alpha',
        tags: ['featured'],
      })
    );
    ws.set(
      createTestNote({
        uri: '/excluded.md',
        title: 'Excluded',
        tags: ['featured'],
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\n```foam-query\nfilter: "#featured"\nselect: title\n```\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Excluded note's title still appears but as plain text, no anchor.
    expect(html).toContain('Excluded');
    expect(html).not.toMatch(/href=['"][^'"]*excluded[^'"]*['"]/);
  });

  it('rewrites a standard markdown link `[Beta](beta.md)` to an in-doc anchor', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    ws.set(createTestNote({ uri: '/beta.md', title: 'Beta' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nSee [Beta](beta.md) for details.\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toMatch(/href=['"]#note-[^'"]*beta[^'"]*['"]/);
    expect(html).not.toMatch(/href=['"]beta\.md['"]/);
  });

  it('resolves relative markdown links from the current note', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/folder/alpha.md', title: 'Alpha' }));
    ws.set(createTestNote({ uri: '/other/beta.md', title: 'Beta' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [
        ws.find(ws.find('alpha')!.uri)!.uri,
        ws.find(ws.find('beta')!.uri)!.uri,
      ],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nSee [Beta](../other/beta.md) elsewhere.\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toMatch(/href=['"]#note-[^'"]*beta[^'"]*['"]/);
    expect(html).not.toMatch(/href=['"]\.\.\/other\/beta\.md['"]/);
  });

  it('leaves external markdown links untouched', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nSee [docs](https://example.com/docs) for more.\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toContain('href="https://example.com/docs"');
  });

  it('drops anchors for markdown links to notes excluded from the report (matches wikilink behavior)', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    ws.set(createTestNote({ uri: '/excluded.md', title: 'Excluded' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nSee [Excluded](excluded.md).\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Text preserved as plain prose; no anchor, no broken-looking href.
    expect(html).toContain('See Excluded.');
    expect(html).not.toMatch(/href=['"]#note-[^'"]*excluded[^'"]*['"]/);
    expect(html).not.toMatch(/href=['"]excluded\.md['"]/);
  });

  it('drops attachment anchors by default so the label renders as plain prose', async () => {
    // Default `'ignore'` mode keeps the HTML portable: a `[label](file.pdf)`
    // reference becomes the bare label, no clickable target that would only
    // resolve on the author's machine.
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/notes/index.md', title: 'Index' }));
    ws.set(
      createTestNote({
        uri: '/notes/files/report.pdf',
        type: 'attachment',
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('/notes/index.md')!.uri],
      noteContent: new Map([
        [
          ws.find('/notes/index.md')!.uri.toString(),
          '# Index\n\nSee [the report](files/report.pdf).\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Visible label preserved, anchor removed.
    expect(html).toContain('See the report.');
    expect(html).not.toMatch(/href=['"][^'"]*report\.pdf['"]/);
    expect(html).not.toContain('file://');
  });

  it('rewrites attachment links to absolute file:// URLs when attachmentLinks is set to "file"', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/notes/index.md', title: 'Index' }));
    ws.set(
      createTestNote({
        uri: '/notes/files/Report Q1.pdf',
        type: 'attachment',
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('/notes/index.md')!.uri],
      noteContent: new Map([
        [
          ws.find('/notes/index.md')!.uri.toString(),
          '# Index\n\nSee [the report](files/Report%20Q1.pdf).\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
      attachmentLinks: 'file',
    });
    // Absolute file:// URL with spaces percent-encoded.
    expect(html).toContain('href="file:///notes/files/Report%20Q1.pdf"');
    expect(html).not.toMatch(/href=['"]files\/Report%20Q1\.pdf['"]/);
  });

  it('rewrites markdown links with a section fragment to the per-note section anchor', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    ws.set(
      createTestNote({
        uri: '/beta.md',
        title: 'Beta',
        sections: ['Intro'],
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nJump to [Beta intro](beta.md#Intro).\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\n## Intro\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toMatch(/href=['"]#note-[^'"]*beta[^'"]*--intro['"]/);
  });

  it('emits a theme toggle button and dark-mode CSS hooks', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [ws.find('alpha')!.uri.toString(), '# Alpha\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // The toggle button exists and carries the accessibility affordances.
    expect(html).toContain('id="report-theme-toggle"');
    expect(html).toContain('aria-label="Toggle dark mode"');
    // Dark-mode CSS variables are defined for both the explicit toggle and
    // the OS preference fallback.
    expect(html).toContain('html[data-theme="dark"]');
    expect(html).toContain('prefers-color-scheme: dark');
    // Theme persistence is handled in the inline script — both the storage
    // key and a localStorage round-trip are present.
    expect(html).toContain("'foam-report-theme'");
    expect(html).toContain('localStorage.getItem');
    expect(html).toContain('localStorage.setItem');
  });

  it('hides the theme toggle (and hover preview infrastructure) when printed', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [ws.find('alpha')!.uri.toString(), '# Alpha\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Extract the @media print block by counting braces so we don't
    // accidentally truncate at a nested rule's closing brace.
    const printBlock = extractMediaBlock(html, 'print');
    expect(printBlock).not.toBeNull();
    // Toggle, hover preview, and the templates container all suppressed when
    // printing so a PDF export doesn't show UI chrome that wouldn't work on
    // paper.
    expect(printBlock).toContain('.report-theme-toggle');
    expect(printBlock).toContain('.report-hover-preview');
    expect(printBlock).toContain('.report-previews');
    expect(printBlock).toMatch(/display:\s*none\s*!important/);
    // The light palette must beat the explicit dark-mode override too, so a
    // user who toggled dark mode still gets a paper-friendly printout.
    expect(printBlock).toContain('html[data-theme="dark"]');
    expect(printBlock).toContain('--report-bg: #ffffff');
    expect(printBlock).toContain('--report-text: #000000');
  });

  it('styles foam-query result tables (header row, borders, structure)', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(
      createTestNote({
        uri: '/alpha.md',
        title: 'Alpha',
        tags: ['featured'],
      })
    );
    ws.set(
      createTestNote({
        uri: '/beta.md',
        title: 'Beta',
        tags: ['featured'],
      })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\n```foam-query\nfilter: "#featured"\nselect: title\nformat: table\n```\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Query renders an actual table with a header row, not just a list.
    expect(html).toMatch(/<table class="foam-query-results">[\s\S]*<thead>/);
    expect(html).toMatch(/<th>title<\/th>/);
    // Stylesheet drives table styling off the report-owned wrapper, not the
    // foam-query-results class string — the dedicated table selector is
    // present so we know the table will get styled.
    expect(html).toContain(
      '.report-note__body .report-query-result > table'
    );
  });

  it('wraps standard markdown tables in a scroll container so they can take full width', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\n| A | B |\n| - | - |\n| 1 | 2 |\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // The table is wrapped in .report-table-wrap (the wrapper owns scroll +
    // border-radius so the table can take 100% width).
    expect(html).toContain('<div class="report-table-wrap">');
    expect(html).toMatch(
      /<div class="report-table-wrap">\s*<table[\s\S]*?<\/table>\s*<\/div>/
    );
  });

  it('wraps foam-query result tables in a report-controlled wrapper carrying the shape', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(
      createTestNote({ uri: '/alpha.md', title: 'Alpha', tags: ['featured'] })
    );
    ws.set(
      createTestNote({ uri: '/beta.md', title: 'Beta', tags: ['featured'] })
    );
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri, ws.find('beta')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\n```foam-query\nfilter: "#featured"\nselect: title\nformat: table\n```\n',
        ],
        [ws.find('beta')!.uri.toString(), '# Beta\n\nBody.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // The wrapper carries the shape forward — warnings (if any) live between
    // the wrapper open and the table per the FoamQueryRenderEvent contract.
    expect(html).toMatch(
      /<div class="report-query-result" data-shape="table">[\s\S]*?<table class="foam-query-results">[\s\S]*?<\/table>[\s\S]*?<\/div>/
    );
  });

  it('emits a sticky breadcrumb header with the report title and slot placeholders for note and section', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [ws.find('alpha')!.uri.toString(), '# Alpha\n\nBody.\n'],
      ]),
      title: 'My Report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Breadcrumb structure: title (always shown), note (hidden until scrolled
    // into), section (hidden until scrolled into).
    expect(html).toContain('id="report-breadcrumb"');
    expect(html).toContain('class="report-breadcrumb__title"');
    expect(html).toMatch(/data-breadcrumb-slot="note"[^>]*hidden/);
    expect(html).toMatch(/data-breadcrumb-slot="section"[^>]*hidden/);
    // Title slot links to the top of the page so users can jump back.
    expect(html).toMatch(
      /class="report-breadcrumb__title"[^>]*>\s*<a href="#top">My Report<\/a>/
    );
    // Breadcrumb is suppressed in print.
    const printBlock = extractMediaBlock(html, 'print');
    expect(printBlock).toContain('.report-breadcrumb');
  });

  it('rewrites author-defined HTML anchor ids so cross-note section links resolve', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/a.md', title: 'A' }));
    ws.set(createTestNote({ uri: '/b.md', title: 'B' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('a')!.uri, ws.find('b')!.uri],
      noteContent: new Map([
        [
          ws.find('a')!.uri.toString(),
          '# A\n\n<a id="hello"></a>Hello World.\n',
        ],
        [
          ws.find('b')!.uri.toString(),
          '# B\n\nSee [the hello](a.md#hello) elsewhere.\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // A's author anchor is scoped to A's slug.
    expect(html).toContain('id="note-a--hello"');
    // B's cross-note link now points at the same scoped id.
    expect(html).toMatch(/href=['"]#note-a--hello['"]/);
  });

  it('keeps duplicate author ids in different notes distinct in the unified document', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/a.md', title: 'A' }));
    ws.set(createTestNote({ uri: '/b.md', title: 'B' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('a')!.uri, ws.find('b')!.uri],
      noteContent: new Map([
        [ws.find('a')!.uri.toString(), '# A\n\n<a id="x"></a>A body.\n'],
        [ws.find('b')!.uri.toString(), '# B\n\n<a id="x"></a>B body.\n'],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    expect(html).toContain('id="note-a--x"');
    expect(html).toContain('id="note-b--x"');
    // No raw collision: the un-scoped id="x" must not appear anywhere in the
    // live document (we leave the preview templates alone but assert on the
    // main article body).
    const articleMatch = html.match(/<article class="report">[\s\S]*?<\/article>/);
    expect(articleMatch).not.toBeNull();
    expect(articleMatch![0]).not.toMatch(/\sid="x"/);
  });

  it('strips the leading H1 when it matches the note title to avoid duplication', async () => {
    const parser = createMarkdownParser();
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/alpha.md', title: 'Alpha' }));
    const graph = FoamGraph.fromWorkspace(ws);
    const html = await renderReport({
      workspace: ws,
      graph,
      parser,
      noteUris: [ws.find('alpha')!.uri],
      noteContent: new Map([
        [
          ws.find('alpha')!.uri.toString(),
          '# Alpha\n\nBody text.\n',
        ],
      ]),
      title: 'Test report',
      generatedAt: new Date('2026-06-24T00:00:00Z'),
      readAttachment: async () => null,
    });
    // Title appears once in the report-note__title, body should not include
    // a second <h1>Alpha</h1> from the markdown.
    const h1Count = (html.match(/<h1[^>]*>Alpha<\/h1>/g) ?? []).length;
    expect(h1Count).toBe(0);
  });
});
