import MarkdownIt from 'markdown-it';
import { URI } from '@foam/core';
import {
  createTestNote,
  createTestWorkspace,
} from '../../../test/test-utils';
import { installMarkdownLinkAnchors } from './markdown-link-anchors';
import { slugForUri } from './slug';

function buildScenario() {
  const ws = createTestWorkspace();
  ws.set(createTestNote({ uri: '/notes/alpha.md', title: 'Alpha' }));
  ws.set(createTestNote({ uri: '/notes/beta.md', title: 'Beta' }));
  ws.set(createTestNote({ uri: '/other/gamma.md', title: 'Gamma' }));

  const included = [ws.find('alpha')!.uri, ws.find('beta')!.uri];
  const slugs = new Map<string, string>();
  for (const uri of included) {
    slugs.set(uri.toString(), slugForUri(uri));
  }
  const reportSlug = (uri: { toString(): string }) =>
    slugs.get(uri.toString()) ?? null;
  const slugByBasename = (basename: string) =>
    reportSlug(ws.find(basename)!.uri);

  return { ws, reportSlug, slugByBasename, alpha: ws.find('alpha')!.uri };
}

describe('installMarkdownLinkAnchors', () => {
  it('rewrites a plain markdown link to an in-doc anchor when the target is included', () => {
    const { ws, reportSlug, slugByBasename, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    const html = md.render('See [Beta](beta.md).');
    const betaSlug = slugByBasename('beta');
    expect(html).toContain(`href="#note-${betaSlug}"`);
    expect(html).toContain('class="foam-note-link"');
    expect(html).toContain(`data-href="#note-${betaSlug}"`);
  });

  it('resolves relative paths against the current note', () => {
    const { ws, reportSlug, slugByBasename, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    const html = md.render('See [Beta](./beta.md).');
    const betaSlug = slugByBasename('beta');
    expect(html).toContain(`href="#note-${betaSlug}"`);
  });

  it('preserves a `#section` fragment and slugs it per-note', () => {
    const { ws, reportSlug, slugByBasename, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    const html = md.render('See [Beta intro](beta.md#Intro).');
    const betaSlug = slugByBasename('beta');
    expect(html).toContain(`href="#note-${betaSlug}--intro"`);
  });

  it('leaves external links alone', () => {
    const { ws, reportSlug, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    const html = md.render('See [docs](https://example.com/x).');
    expect(html).toContain('href="https://example.com/x"');
    expect(html).not.toContain('foam-note-link');
  });

  it('leaves mailto and protocol-relative links alone', () => {
    const { ws, reportSlug, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    const m = md.render('[mail](mailto:a@b.com)');
    expect(m).toContain('href="mailto:a@b.com"');
    expect(m).not.toContain('foam-note-link');
  });

  it('drops the anchor for notes in the workspace but excluded from the report, matching wikilink semantics', () => {
    const { ws, reportSlug, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    // Gamma is in the workspace but not in the report set. Wikilinks to
    // excluded notes render as plain text via createHtmlPageLinkResolver —
    // the markdown-link rewriter mirrors that so `[[x]]` and `[label](x.md)`
    // are semantically equivalent for the reader.
    const html = md.render('See [Gamma](../other/gamma.md).');
    expect(html).toContain('See Gamma.');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('foam-note-link');
  });

  it('leaves bare fragment links alone', () => {
    const { ws, reportSlug, alpha } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => alpha,
      reportSlug,
    });
    const html = md.render('Jump to [section](#section).');
    expect(html).toContain('href="#section"');
    expect(html).not.toContain('foam-note-link');
  });

  it('is a no-op when no current note is set', () => {
    const { ws, reportSlug } = buildScenario();
    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => null,
      reportSlug,
    });
    const html = md.render('See [Beta](beta.md).');
    expect(html).toContain('href="beta.md"');
    expect(html).not.toContain('foam-note-link');
  });

  it('resolves an ambiguous basename via the sibling-file path, not via identifier lookup', () => {
    // Two `glossary.md` in different project trees. From `/projA/_wiki/index.md`,
    // the link `[g](glossary.md)` should resolve to the SAME-DIRECTORY file,
    // not to whichever one wins the workspace's identifier sort. Without this
    // behaviour a real workspace with parallel project directories will silently
    // route every cross-note section link to the wrong note.
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/projA/_wiki/index.md', title: 'A Index' }));
    ws.set(
      createTestNote({
        uri: '/projA/_wiki/glossary.md',
        title: 'A Glossary',
      })
    );
    ws.set(
      createTestNote({
        uri: '/projB/_wiki/glossary.md',
        title: 'B Glossary',
      })
    );
    const reportSet = [
      ws.find(ws.find('/projA/_wiki/index.md')!.uri)!.uri,
      ws.find(ws.find('/projA/_wiki/glossary.md')!.uri)!.uri,
    ];
    const slugs = new Map<string, string>();
    for (const uri of reportSet) {
      // Use distinct slugs so the assertion can prove which one was picked.
      slugs.set(uri.toString(), uri.path.includes('projA') ? 'a-glossary' : 'b-glossary');
    }
    const reportSlug = (uri: URI) => slugs.get(uri.toString()) ?? null;

    const md = MarkdownIt();
    installMarkdownLinkAnchors(md, {
      workspace: ws,
      getCurrentNoteUri: () => ws.find('/projA/_wiki/index.md')!.uri,
      reportSlug,
    });
    const html = md.render('See [A Glossary](glossary.md).');
    expect(html).toContain('href="#note-a-glossary"');
  });

  describe('attachment links', () => {
    function buildAttachmentScenario() {
      const ws = createTestWorkspace();
      ws.set(createTestNote({ uri: '/notes/index.md', title: 'Index' }));
      ws.set(
        createTestNote({
          uri: '/notes/files/Report Q1.pdf',
          type: 'attachment',
        })
      );
      const reportSlug = () => null; // no notes in the report set for this scope
      return { ws, reportSlug, index: ws.find('/notes/index.md')!.uri };
    }

    it('rewrites a markdown link to a workspace attachment using whatever attachmentHref returns', () => {
      const { ws, reportSlug, index } = buildAttachmentScenario();
      const md = MarkdownIt();
      installMarkdownLinkAnchors(md, {
        workspace: ws,
        getCurrentNoteUri: () => index,
        reportSlug,
        // Stub mirrors the production resolver's contract: caller owns the
        // returned href value verbatim (no extra encoding from the plugin).
        attachmentHref: uri => `custom://attachment${uri.path}`,
      });
      const html = md.render('See [the report](files/Report%20Q1.pdf).');
      expect(html).toContain(
        'href="custom://attachment/notes/files/Report Q1.pdf"'
      );
      expect(html).toContain(
        'data-href="custom://attachment/notes/files/Report Q1.pdf"'
      );
    });

    it('drops the anchor when attachmentHref returns null, matching the wikilink/excluded-note semantics', () => {
      // Returning `null` from `attachmentHref` is the explicit "no link"
      // signal — the label renders as plain prose. Same shape used when a
      // wikilink or markdown link points at a note outside the report set.
      const { ws, reportSlug, index } = buildAttachmentScenario();
      const md = MarkdownIt();
      installMarkdownLinkAnchors(md, {
        workspace: ws,
        getCurrentNoteUri: () => index,
        reportSlug,
        attachmentHref: () => null,
      });
      const html = md.render('See [the report](files/Report%20Q1.pdf).');
      expect(html).toContain('See the report.');
      expect(html).not.toContain('href=');
    });

    it('does not call attachmentHref for note targets', () => {
      // Only notes — no attachments. If attachmentHref were ever called we'd
      // see "TOUCHED" in the output, which the assertion forbids.
      const { ws, reportSlug, alpha } = buildScenario();
      const md = MarkdownIt();
      installMarkdownLinkAnchors(md, {
        workspace: ws,
        getCurrentNoteUri: () => alpha,
        reportSlug,
        attachmentHref: () => 'TOUCHED',
      });
      const html = md.render('See [Beta](beta.md).');
      expect(html).not.toContain('TOUCHED');
    });
  });
});
