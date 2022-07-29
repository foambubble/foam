import MarkdownIt from 'markdown-it';
import { createMarkdownParser } from '../../core/services/markdown-parser';
import { FoamWorkspace } from '../../core/model/workspace';
import { createTestNote } from '../../test/test-utils';
import { getUriInWorkspace } from '../../test/test-utils-vscode';
import markdownItWikilinkNavigation from './wikilink-navigation';
import markdownItRemoveLinkReferences from './remove-wikilink-references';

const parser = createMarkdownParser();

describe('Link generation in preview', () => {
  const noteA = createTestNote({
    uri: './path/to/note-a.md',
    // TODO: this should really just be the workspace folder, use that once #806 is fixed
    root: getUriInWorkspace('just-a-ref.md'),
    title: 'My note title',
    links: [{ slug: 'placeholder' }],
  });
  const ws = new FoamWorkspace().set(noteA);

  const md = [
    markdownItWikilinkNavigation,
    markdownItRemoveLinkReferences,
  ].reduce((acc, extension) => extension(acc, ws), MarkdownIt());

  it('generates a link to a note', () => {
    expect(md.render(`[[note-a]]`)).toEqual(
      `<p><a class='foam-note-link' title='${noteA.title}' href='/path/to/note-a.md' data-href='/path/to/note-a.md'>note-a</a></p>\n`
    );
  });

  it('generates a link to a placeholder resource', () => {
    expect(md.render(`[[placeholder]]`)).toEqual(
      `<p><a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">placeholder</a></p>\n`
    );
  });

  it('generates a placeholder link to an unknown slug', () => {
    expect(md.render(`[[random-text]]`)).toEqual(
      `<p><a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">random-text</a></p>\n`
    );
  });

  it('generates a wikilink even when there is a link reference', () => {
    const note = `[[note-a]]
    [note-a]: <note-a.md> "Note A"`;
    expect(md.render(note)).toEqual(
      `<p><a class='foam-note-link' title='${noteA.title}' href='/path/to/note-a.md' data-href='/path/to/note-a.md'>note-a</a>\n[note-a]: &lt;note-a.md&gt; &quot;Note A&quot;</p>\n`
    );
  });
});
