import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { URI } from '@foam/core';
import { createMarkdownParser } from '@foam/core';
import { createRenderContext } from '@foam/core';
import { createTestNote, createTestWorkspace } from '../../../test/test-utils';
import { markdownItFoamQuery } from './foam-query-renderer';

describe('markdownItFoamQuery', () => {
  const root = URI.file('/test-workspace/ref.md');

  const noteA = createTestNote({
    uri: 'notes/alpha.md',
    title: 'Alpha',
    tags: ['research'],
    root,
  });
  const noteB = createTestNote({
    uri: 'notes/beta.md',
    title: 'Beta',
    tags: ['research', 'draft'],
    root,
  });
  const noteC = createTestNote({
    uri: 'notes/gamma.md',
    title: 'Gamma',
    tags: ['other'],
    root,
  });

  const noteD = createTestNote({
    uri: 'notes/delta.md',
    title: 'Delta',
    tags: ['research'],
    root,
    properties: { status: 'published', date: '2024-01-01' },
  });

  const ws = new FoamWorkspace().set(noteA).set(noteB).set(noteC).set(noteD);
  const graph = FoamGraph.fromWorkspace(ws, false);

  const workspaceRoot = '/test-workspace';
  // The renderer's `toHref` contract is "return the full href value". Tests
  // assert on the previous shape — workspace-relative path with a leading
  // slash — so the stub builds it directly instead of relying on `noteLink`
  // to prepend `/` (it no longer does).
  const toHref = (uri: { path: string }) => {
    const rel = uri.path.startsWith(workspaceRoot)
      ? uri.path.slice(workspaceRoot.length)
      : uri.path;
    return `/${rel.replace(/^\//, '')}`;
  };

  const md = markdownItFoamQuery(MarkdownIt(), ws, graph, {
    isTrusted: () => true,
    toHref,
    renderContext: createRenderContext(),
  });

  describe('placeholder — empty blocks', () => {
    it('renders a placeholder for an empty foam-query block', () => {
      const result = md.render('```foam-query\n```');
      expect(result).toContain('foam-query-placeholder');
      expect(result).not.toContain('foam-query-results');
    });

    it('renders a placeholder for a whitespace-only foam-query block', () => {
      const result = md.render('```foam-query\n   \n```');
      expect(result).toContain('foam-query-placeholder');
    });

    it('placeholder includes a syntax example', () => {
      const result = md.render('```foam-query\n```');
      expect(result).toContain('filter:');
    });

    it('renders a placeholder for an empty foam-query-js block', () => {
      const result = md.render('```foam-query-js\n```');
      expect(result).toContain('foam-query-placeholder');
      expect(result).not.toContain('foam-query-results');
    });

    it('placeholder for foam-query-js includes a code example', () => {
      const result = md.render('```foam-query-js\n```');
      expect(result).toContain('foam.pages');
    });
  });

  describe('pass-through', () => {
    it('leaves regular code fences unchanged', () => {
      const result = md.render('```typescript\nconst x = 1;\n```');
      expect(result).toContain('const x = 1;');
      expect(result).not.toContain('foam-query-results');
    });

    it('leaves regular markdown unchanged', () => {
      const result = md.render('# Hello\n\nsome text');
      expect(result).toContain('Hello');
      expect(result).not.toContain('foam-query');
    });
  });

  describe('foam-query — DQL blocks', () => {
    it('renders matching notes as a list by default', () => {
      const result = md.render('```foam-query\nfilter: "#research"\n```');
      expect(result).toContain('<ul class="foam-query-results">');
      expect(result).toContain('foam-note-link');
      expect(result).toContain('Alpha');
      expect(result).toContain('Beta');
      expect(result).not.toContain('Gamma');
    });

    it('renders a table when format is table', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nformat: table\nselect: [title, type]\n```'
      );
      expect(result).toContain('<table class="foam-query-results">');
      expect(result).toContain('<th>title</th>');
      expect(result).toContain('<th>type</th>');
      expect(result).toContain('Alpha');
      expect(result).toContain('Beta');
      expect(result).not.toContain('Gamma');
    });

    it('infers table format when multiple fields are selected', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nselect: [title, type]\n```'
      );
      expect(result).toContain('<table class="foam-query-results">');
    });

    it('renders count format', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nformat: count\n```'
      );
      expect(result).toContain('3 notes');
    });

    it('renders singular "note" for a single result', () => {
      const result = md.render(
        '```foam-query\nfilter: "#other"\nformat: count\n```'
      );
      expect(result).toContain('1 note');
      expect(result).not.toContain('1 notes');
    });

    it('renders "No results" message for an empty result set', () => {
      const result = md.render(
        '```foam-query\nfilter: "#nonexistent-tag"\n```'
      );
      expect(result).toContain('foam-query-empty');
    });

    it('generates foam-note-link anchors pointing to the note path', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nsort: title ASC\nlimit: 1\n```'
      );
      expect(result).toContain('class="foam-note-link"');
      expect(result).toContain('/notes/alpha.md');
    });

    it('respects sort ASC', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nsort: title ASC\n```'
      );
      expect(result.indexOf('Alpha')).toBeLessThan(result.indexOf('Beta'));
    });

    it('respects sort DESC', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nsort: title DESC\n```'
      );
      expect(result.indexOf('Beta')).toBeLessThan(result.indexOf('Alpha'));
    });

    it('respects limit', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nsort: title ASC\nlimit: 1\n```'
      );
      expect(result).toContain('Alpha');
      expect(result).not.toContain('Beta');
    });

    it('renders the selected field as text when title is not selected', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nselect: [path]\n```'
      );
      expect(result).toContain('<ul class="foam-query-results">');
      expect(result).toContain('alpha.md');
      expect(result).toContain('beta.md');
      expect(result).not.toMatch(/<a[^>]*><\/a>/);
    });

    it('renders all notes when filter is omitted', () => {
      const result = md.render('```foam-query\nformat: count\n```');
      expect(result).toContain('4 notes');
    });

    it('renders a YAML parse error gracefully when the whole block is invalid', () => {
      const result = md.render('```foam-query\n: bad: {\n```');
      expect(result).toContain('foam-query-error');
      expect(result).toContain('YAML parse error');
      expect(result).toContain('foam-query-placeholder');
    });

    it('shows placeholder while typing a partial field name (not yet a mapping)', () => {
      for (const partial of ['f', 'fi', 'filter']) {
        const result = md.render(`\`\`\`foam-query\n${partial}\n\`\`\``);
        expect(result).toContain('foam-query-placeholder');
        expect(result).not.toContain('foam-query-results');
      }
    });

    it('shows placeholder and a hint when filter has no value', () => {
      const result = md.render('```foam-query\nfilter:\n```');
      expect(result).toContain('foam-query-placeholder');
      expect(result).toContain('foam-query-warning');
      expect(result).toContain('*');
      expect(result).not.toContain('foam-query-results');
    });

    it('shows filter hint even when other valid fields are present', () => {
      const result = md.render('```foam-query\nfilter:\nformat: count\n```');
      expect(result).toContain('foam-query-placeholder');
      expect(result).toContain('foam-query-warning');
      expect(result).not.toContain('foam-query-results');
    });

    it('renders partial results and a warning when only a later line is invalid', () => {
      const result = md.render(
        '```foam-query\nfilter: "#research"\nformat: [\n```'
      );
      expect(result).toContain('Alpha');
      expect(result).toContain('Beta');
      expect(result).not.toContain('Gamma');
      expect(result).toContain('foam-query-warning');
    });

    it('falls back to placeholder when no valid content can be recovered', () => {
      const result = md.render('```foam-query\n: bad: {\n: also bad: {\n```');
      expect(result).toContain('foam-query-placeholder');
      expect(result).toContain('foam-query-error');
      expect(result).not.toContain('foam-query-results');
    });

    it('renders results and warns about unknown fields', () => {
      const result = md.render(
        '```foam-query\nfliter: "#research"\nformat: count\n```'
      );
      // filter is missing so all notes match
      expect(result).toContain('4 notes');
      expect(result).toContain('foam-query-warning');
      expect(result).toContain('fliter');
    });

    it('warns once per unknown field', () => {
      const result = md.render(
        '```foam-query\nfliter: "#research"\nsorting: title ASC\nformat: count\n```'
      );
      expect(result).toContain('fliter');
      expect(result).toContain('sorting');
      expect(result).toContain('foam-query-warning');
    });

    describe('field value validation', () => {
      it('shows placeholder and warning when filter has wrong type', () => {
        const result = md.render('```foam-query\nfilter: [bad]\n```');
        expect(result).toContain('foam-query-placeholder');
        expect(result).toContain('foam-query-warning');
        expect(result).not.toContain('foam-query-results');
      });

      it('warns and strips select when it is an empty array', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: []\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('select');
        expect(result).toContain('Alpha');
      });

      it('warns and strips select when it is not an array', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: title\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('select');
        expect(result).toContain('Alpha');
      });

      it('warns and strips sort when it is not a string', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nsort: 123\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('sort');
        expect(result).toContain('Alpha');
      });

      it('warns and strips limit when it is not a positive integer', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nlimit: -1\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('limit');
        expect(result).toContain('Alpha');
        expect(result).toContain('Beta');
      });

      it('warns and strips format when it is not a valid value', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nformat: bad\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('format');
        expect(result).toContain('Alpha');
      });
    });

    describe('properties dot notation in select', () => {
      it('renders a property value as a table column', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: [title, properties.status]\nformat: table\n```'
        );
        expect(result).toContain('<th>status</th>');
        expect(result).toContain('published'); // noteD has status: published
      });

      it('renders empty cell for notes missing the property', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: [title, properties.status]\nformat: table\n```'
        );
        // Alpha and Beta have no status property — their cells should be empty
        expect(result).toContain('<td></td>');
        // No warning for missing property on a note
        expect(result).not.toContain('foam-query-warning');
      });

      it('renders a property value in list format and skips notes without that property', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: [properties.status]\n```'
        );
        expect(result).toContain('published'); // noteD has status
        expect(result).not.toContain('<li></li>'); // no empty bullets for notes missing the property
      });

      it('accepts properties.X fields without warning', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: [title, properties.anything]\nformat: table\n```'
        );
        expect(result).not.toContain('foam-query-warning');
      });
    });

    describe('unknown fields in select', () => {
      it('warns and strips unknown select elements, keeps valid ones', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: [title, unknown_field]\nformat: table\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('unknown_field');
        expect(result).toContain('Alpha'); // valid field still renders
        expect(result).not.toContain('<th>unknown_field</th>');
      });

      it('falls back to default select when all elements are unknown', () => {
        const result = md.render(
          '```foam-query\nfilter: "#research"\nselect: [bad1, bad2]\n```'
        );
        expect(result).toContain('foam-query-warning');
        expect(result).toContain('Alpha'); // falls back to default (title)
      });
    });

    it('title cells in tables render as foam-note-link anchors', () => {
      const result = md.render(
        '```foam-query\nfilter: "#other"\nformat: table\nselect: [title, type]\n```'
      );
      expect(result).toContain('class="foam-note-link"');
      expect(result).toContain('/notes/gamma.md');
    });

    it('non-title cells render as plain text, not links', () => {
      const result = md.render(
        '```foam-query\nfilter: "#other"\nformat: table\nselect: [title, type]\n```'
      );
      // 'type' column value should be plain text, not an anchor
      const typeCell = result.match(/<td>([^<]+)<\/td>/)?.[1];
      expect(typeCell).toBeDefined();
      expect(typeCell).not.toContain('<a');
    });
  });

  describe('foam-query — DQL $current', () => {
    const targetNote = createTestNote({ uri: '/test-workspace/target.md', title: 'Target' });
    const linkingNote = createTestNote({
      uri: '/test-workspace/linking.md',
      title: 'Linking',
      links: [{ slug: 'target' }],
    });
    const ws3 = createTestWorkspace().set(targetNote).set(linkingNote);
    const graph3 = FoamGraph.fromWorkspace(ws3, false);

    it('links_to: "$current" matches notes linking to the current note', () => {
      const mdWithCurrent = markdownItFoamQuery(MarkdownIt(), ws3, graph3, {
        isTrusted: () => true,
        toHref,
        getCurrentResource: () => targetNote,
        renderContext: createRenderContext(),
      });
      const result = mdWithCurrent.render(
        '```foam-query\nfilter:\n  links_to: "$current"\nformat: count\n```'
      );
      expect(result).toContain('1 note');
    });

    it('links_from: "$current" matches notes linked from the current note', () => {
      const mdWithCurrent = markdownItFoamQuery(MarkdownIt(), ws3, graph3, {
        isTrusted: () => true,
        toHref,
        getCurrentResource: () => linkingNote,
        renderContext: createRenderContext(),
      });
      const result = mdWithCurrent.render(
        '```foam-query\nfilter:\n  links_from: "$current"\nformat: count\n```'
      );
      expect(result).toContain('1 note');
    });

    it('shows a warning when $current is used but no current resource is available', () => {
      const result = md.render(
        '```foam-query\nfilter:\n  links_to: "$current"\nformat: count\n```'
      );
      expect(result).toContain('foam-query-warning');
    });
  });

  describe('foam.current', () => {
    it('is null when no getCurrentResource is provided', () => {
      const result = md.render(
        '```foam-query-js\nrender(String(foam.current));\n```'
      );
      expect(result).toContain('null');
    });

    it('exposes the URI of the current resource when provided', () => {
      const mdWithCurrent = markdownItFoamQuery(MarkdownIt(), ws, graph, {
        isTrusted: () => true,
        toHref,
        getCurrentResource: () => noteA,
        renderContext: createRenderContext(),
      });
      const result = mdWithCurrent.render(
        '```foam-query-js\nrender(foam.current.path);\n```'
      );
      expect(result).toContain(noteA.uri.path);
    });

    it('can be used as a filter to query pages linking to the current note', () => {
      const targetNote = createTestNote({ uri: '/test-workspace/target.md', title: 'Target' });
      const linkingNote = createTestNote({
        uri: '/test-workspace/linking.md',
        title: 'Linking',
        links: [{ slug: 'target' }],
      });
      const ws2 = createTestWorkspace().set(targetNote).set(linkingNote);
      const graph2 = FoamGraph.fromWorkspace(ws2, false);
      const mdWithCurrent = markdownItFoamQuery(MarkdownIt(), ws2, graph2, {
        isTrusted: () => true,
        toHref,
        getCurrentResource: () => targetNote,
        renderContext: createRenderContext(),
      });
      const result = mdWithCurrent.render(
        "```foam-query-js\nrender(foam.pages({links_to: foam.current}).format('count'));\n```"
      );
      expect(result).toContain('1 note');
    });
  });

  describe('foam-query-js — JS blocks', () => {
    it('renders output from render() calls', () => {
      const result = md.render(
        "```foam-query-js\nrender(foam.pages('#research').format('count'));\n```"
      );
      expect(result).toContain('3 notes');
    });

    it('supports calling render() with a plain string', () => {
      const result = md.render('```foam-query-js\nrender("hello world");\n```');
      expect(result).toContain('hello world');
    });

    it('supports multi-line scripts with logic', () => {
      const result = md.render(
        [
          '```foam-query-js',
          "const all = foam.pages('#research').sortBy('title').limit(1);",
          "render(all.format('list'));",
          '```',
        ].join('\n')
      );
      expect(result).toContain('Alpha');
      expect(result).not.toContain('Beta');
    });

    it('supports multiple render() calls which append output', () => {
      const result = md.render(
        [
          '```foam-query-js',
          'render("first");',
          'render("second");',
          '```',
        ].join('\n')
      );
      expect(result).toContain('first');
      expect(result).toContain('second');
    });

    it('shows a message when render() is never called', () => {
      const result = md.render('```foam-query-js\nconst x = 1;\n```');
      expect(result).toContain('foam-query-empty');
    });

    it('renders a script runtime error gracefully', () => {
      const result = md.render(
        '```foam-query-js\nthrow new Error("boom");\n```'
      );
      expect(result).toContain('foam-query-error');
      expect(result).toContain('boom');
    });

    it('blocked globals are not accessible', () => {
      const result = md.render(
        '```foam-query-js\nrender(typeof require);\n```'
      );
      // require should be undefined in the sandbox
      expect(result).toContain('undefined');
    });

    it('title cells in JS table render as foam-note-link even when path is not selected', () => {
      const result = md.render(
        [
          '```foam-query-js',
          "render(foam.pages('#other').select(['title','type']).format('table'));",
          '```',
        ].join('\n')
      );
      expect(result).toContain('class="foam-note-link"');
      expect(result).toContain('/notes/gamma.md');
      // path should not appear as a table column
      expect(result).not.toContain('<th>path</th>');
    });

    it('shows untrusted message when isTrusted returns false', () => {
      const untrustedMd = markdownItFoamQuery(MarkdownIt(), ws, graph, {
        isTrusted: () => false,
        toHref,
        renderContext: createRenderContext(),
      });
      const result = untrustedMd.render(
        '```foam-query-js\nrender("hello");\n```'
      );
      expect(result).toContain('foam-query-untrusted');
    });
  });

  // End-to-end coverage for `body` / `content` / `section[Label]` selection
  // through the real fence pipeline. Source reads and inner-markdown rendering
  // are dependency-injected so the test doesn't touch the filesystem.

  describe('source-derived fields end to end', () => {
    // Build a fresh workspace with real (parsed-from-markdown) notes so the
    // section ranges line up with the source we hand back from `readSource`.
    const parser = createMarkdownParser();
    const aSource = [
      '---',
      'status: to_ask',
      '---',
      '# Alpha',
      '',
      'See [[beta]] for context.',
      '',
      '## Question',
      '',
      'What is X?',
      '',
    ].join('\n');
    const bSource = '# Beta\n\nbeta body\n';

    const alphaUri = URI.file('/test-workspace/notes/alpha.md');
    const betaUri = URI.file('/test-workspace/notes/beta.md');
    const parsedA = parser.parse(alphaUri, aSource);
    const parsedB = parser.parse(betaUri, bSource);
    const ws2 = new FoamWorkspace().set(parsedA).set(parsedB);
    const graph2 = FoamGraph.fromWorkspace(ws2, false);

    const sources: Record<string, string> = {
      [alphaUri.path]: aSource,
      [betaUri.path]: bSource,
    };
    const readSource = (uri: URI) => sources[uri.path] ?? null;

    // Toy inner markdown: emits identifiable wrappers without depending on
    // the real markdown-it Foam pipeline.
    const createInnerMd = () =>
      ({
        render: (text: string) => `<INNER>${text}</INNER>`,
      } as unknown as MarkdownIt);

    const mdWithSource = markdownItFoamQuery(MarkdownIt(), ws2, graph2, {
      isTrusted: () => true,
      toHref,
      readSource,
      createInnerMd,
      renderContext: createRenderContext(),
    });

    it('renders `body` cells through the inner markdown-it instance', () => {
      const result = mdWithSource.render(
        '```foam-query\nfilter:\n  path: alpha\nselect: [body]\n```'
      );
      // The toy renderer wraps cell content with <INNER>…</INNER>, which is
      // only emitted when the cell was routed through `renderMarkdown`.
      expect(result).toContain('<INNER>');
      expect(result).toContain('# Alpha');
      // Frontmatter must not leak into the rendered cell.
      expect(result).not.toContain('status: to_ask');
    });

    it('renders `content` cells with the H1 stripped', () => {
      const result = mdWithSource.render(
        '```foam-query\nfilter:\n  path: alpha\nselect: [title, content]\n```'
      );
      expect(result).toContain('<INNER>');
      // `content` removes the H1 line.
      expect(result).not.toContain('<INNER># Alpha');
      expect(result).toContain('See [[beta]] for context.');
    });

    it('renders `section[Label]` cells with the heading stripped (case-sensitive match)', () => {
      const result = mdWithSource.render(
        "```foam-query\nfilter:\n  path: alpha\nselect:\n  - 'section[Question]'\n```"
      );
      expect(result).toContain('What is X?');
      expect(result).not.toContain('## Question');
    });

    it('rewrites wikilinks inside source-derived cells to absolute workspace paths', () => {
      // The rendered `body` of /alpha.md contains `[[beta]]`. When this cell
      // is rendered from somewhere else in the preview, the link target must
      // resolve against alpha's location, not the surrounding page's. The
      // rewrite stage converts `[[beta]]` to a workspace-absolute reference
      // before the inner markdown-it sees it.
      const captured: string[] = [];
      const captureInnerMd = () =>
        ({
          render: (text: string) => {
            captured.push(text);
            return text;
          },
        } as unknown as MarkdownIt);

      const mdWithRewrite = markdownItFoamQuery(MarkdownIt(), ws2, graph2, {
        isTrusted: () => true,
        toHref,
        readSource,
        createInnerMd: captureInnerMd,
        parser,
        renderContext: createRenderContext(),
      });

      mdWithRewrite.render(
        '```foam-query\nfilter:\n  path: alpha\nselect: [body]\n```'
      );

      // Exactly one cell rendered through the inner md (the body of alpha).
      expect(captured).toHaveLength(1);
      // The original `[[beta]]` slug should have been rewritten to point at
      // beta's absolute path inside the workspace.
      expect(captured[0]).not.toContain('[[beta]]');
      expect(captured[0]).toContain('/notes/beta.md');
    });

    it('detects a self-referencing query cycle and emits a warning instead of recursing', () => {
      // alpha's body contains a foam-query that matches alpha itself. The
      // outer render asks for alpha's body; the inner render of that body
      // would try to render alpha's body again, which would loop forever
      // without cycle protection.
      const cyclicSource = [
        '# Alpha',
        '',
        '```foam-query',
        'filter:',
        '  path: alpha',
        'select: [body]',
        '```',
        '',
      ].join('\n');
      const cyclicSources = { [alphaUri.path]: cyclicSource };
      const cyclicReadSource = (uri: URI) => cyclicSources[uri.path] ?? null;

      const parsedAlpha = parser.parse(alphaUri, cyclicSource);
      const wsCyc = new FoamWorkspace().set(parsedAlpha);
      const graphCyc = FoamGraph.fromWorkspace(wsCyc, false);

      // Inner md gets the *same* query plugin so the recursion path is real,
      // and the *same* RenderContext so the outer push is visible inside.
      // Without a shared context the cycle detection wouldn't trip.
      const sharedContext = createRenderContext();
      const buildPlugin = () =>
        markdownItFoamQuery(MarkdownIt(), wsCyc, graphCyc, {
          isTrusted: () => true,
          toHref,
          readSource: cyclicReadSource,
          createInnerMd: buildPlugin,
          parser,
          renderContext: sharedContext,
        });

      const result = buildPlugin().render(
        '```foam-query\nfilter:\n  path: alpha\nselect: [body]\n```'
      );

      // Cycle warning was emitted instead of overflowing the stack.
      expect(result).toContain('foam-query-cycle');
      expect(result).toContain(alphaUri.path);
    });

    it('a query inside a source-derived cell sees the source note as `$current`, not the outer page', () => {
      // Setup: note alpha has a query body that asks for notes linking to
      // `$current` (i.e. linking to alpha). Note gamma links to alpha. When
      // the outer render returns alpha (via the title query), alpha's body
      // is rendered through the inner md, and inside that body the inner
      // query must see alpha as `$current` so it finds gamma.
      //
      // Without the fix, `$current` would resolve to whatever the outer
      // `getCurrentResource` returns (we pass `null`) and the inner query
      // would emit "no current note" warnings instead of finding gamma.
      // alpha's body contains a foam-query whose `$current` placeholder
      // should resolve to alpha when the inner pipeline renders this body.
      const alphaSrc = [
        '# Alpha',
        '',
        '```foam-query',
        'filter:',
        '  links_to: $current',
        'select: [title]',
        '```',
        '',
      ].join('\n');
      // Use `createTestNote` so the workspace has a provider and `FoamGraph`
      // can resolve links — we only need the link wiring here, not real
      // section parsing.
      const alphaNote = createTestNote({
        uri: '/test-workspace/cur-alpha.md',
        title: 'Alpha',
      });
      const gammaNote = createTestNote({
        uri: '/test-workspace/cur-gamma.md',
        title: 'Gamma',
        links: [{ slug: 'cur-alpha' }],
      });
      const wsCur = createTestWorkspace().set(alphaNote).set(gammaNote);
      const graphCur = FoamGraph.fromWorkspace(wsCur, false);

      const sources: Record<string, string> = {
        [alphaNote.uri.path]: alphaSrc,
      };
      const sharedContext = createRenderContext();

      // `getCurrentResource` resolves from the context first (matches the
      // production wiring in features/preview/index.ts) and otherwise
      // returns null — there is no outer "active editor" in this test.
      const getCurrent = () => {
        const stack = sharedContext.current();
        if (stack.length > 0) {
          return wsCur.find(stack[stack.length - 1]) ?? null;
        }
        return null;
      };

      const buildPlugin = () =>
        markdownItFoamQuery(MarkdownIt(), wsCur, graphCur, {
          isTrusted: () => true,
          toHref,
          readSource: (uri: URI) => sources[uri.path] ?? null,
          createInnerMd: buildPlugin,
          parser,
          renderContext: sharedContext,
          getCurrentResource: getCurrent,
        });

      const result = buildPlugin().render(
        '```foam-query\nfilter:\n  path: cur-alpha\nselect: [body]\n```'
      );

      // Inner query finds gamma because `$current` resolved to alpha.
      expect(result).toContain('Gamma');
      // Should NOT contain the "no current note" warning.
      expect(result).not.toContain('no note is currently active');
    });

    it('when the inner md has html disabled, raw HTML in a body cell is escaped instead of injected', () => {
      // Security guard: a query cell renders another note's source through
      // the inner markdown-it. If the host built the inner md with `html:
      // false` (mirroring the user's `markdown.preview.unsafe` lockdown),
      // raw `<script>` in a note's body must come out escaped — not as a
      // live DOM node — even when the cell is selected via `body`.
      const safeSrc = '# Alpha\n\n<script>alert(1)</script>\n';
      const safeSources = { [alphaUri.path]: safeSrc };
      const parsedSafe = parser.parse(alphaUri, safeSrc);
      const wsSafe = new FoamWorkspace().set(parsedSafe);
      const graphSafe = FoamGraph.fromWorkspace(wsSafe, false);
      // Build the inner md with html: false (real markdown-it instance so
      // the html option is honoured by the renderer).
      const safeInnerMd = () => MarkdownIt({ html: false });
      const mdSafe = markdownItFoamQuery(MarkdownIt(), wsSafe, graphSafe, {
        isTrusted: () => true,
        toHref,
        readSource: (uri: URI) => safeSources[uri.path] ?? null,
        createInnerMd: safeInnerMd,
        parser,
        renderContext: createRenderContext(),
      });

      const html = mdSafe.render(
        '```foam-query\nfilter:\n  path: alpha\nselect: [body]\n```'
      );
      // The literal `<script>` must not appear as raw HTML — it should be
      // escaped to `&lt;script&gt;` by the inner markdown-it.
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('falls back to escaped raw markdown when createInnerMd is not provided', () => {
      const mdWithoutInner = markdownItFoamQuery(MarkdownIt(), ws2, graph2, {
        isTrusted: () => true,
        toHref,
        readSource,
        renderContext: createRenderContext(),
        // no createInnerMd
      });
      const result = mdWithoutInner.render(
        "```foam-query\nfilter:\n  path: alpha\nselect: [body]\n```"
      );
      expect(result).not.toContain('<INNER>');
      // Raw markdown shown escaped — the `#` survives but no HTML tags emitted
      // by the cell.
      expect(result).toContain('# Alpha');
    });
  });
});
