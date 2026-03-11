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

  const ws = new FoamWorkspace().set(noteA).set(noteB).set(noteC);
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
      expect(result).toContain('2 notes');
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
      expect(result).toContain("class='foam-note-link'");
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

    it('renders all notes when filter is omitted', () => {
      const result = md.render('```foam-query\nformat: count\n```');
      expect(result).toContain('3 notes');
    });

    it('renders a YAML parse error gracefully', () => {
      const result = md.render('```foam-query\n: bad: {\n```');
      expect(result).toContain('foam-query-error');
      expect(result).toContain('YAML parse error');
    });

    it('title cells in tables render as foam-note-link anchors', () => {
      const result = md.render(
        '```foam-query\nfilter: "#other"\nformat: table\nselect: [title, type]\n```'
      );
      expect(result).toContain("class='foam-note-link'");
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
      expect(result).toContain('2 notes');
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
