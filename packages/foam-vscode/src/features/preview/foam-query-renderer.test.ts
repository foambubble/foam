import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamGraph } from '../../core/model/graph';
import { URI } from '../../core/model/uri';
import { createTestNote } from '../../test/test-utils';
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
  const toRelativePath = (uriPath: string) =>
    uriPath.startsWith(workspaceRoot)
      ? uriPath.slice(workspaceRoot.length)
      : uriPath;

  const md = markdownItFoamQuery(MarkdownIt(), ws, graph, {
    isTrusted: () => true,
    toRelativePath,
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
        expect(result).toContain('<th>properties.status</th>');
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
        toRelativePath,
      });
      const result = untrustedMd.render(
        '```foam-query-js\nrender("hello");\n```'
      );
      expect(result).toContain('foam-query-untrusted');
    });
  });
});
