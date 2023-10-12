import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace';
import { createTestNote } from '../../test/test-utils';
import { getUriInWorkspace } from '../../test/test-utils-vscode';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';

describe('Link generation in preview', () => {
  const noteA = createTestNote({
    uri: './path/to/note-a.md',
    // TODO: this should really just be the workspace folder, use that once #806 is fixed
    root: getUriInWorkspace('just-a-ref.md'),
    title: 'My note title',
    links: [{ slug: 'placeholder' }],
  });
  const noteB = createTestNote({
    uri: './path2/to/note-b.md',
    root: getUriInWorkspace('just-a-ref.md'),
    title: 'My second note',
    sections: ['sec1', 'sec2'],
  });
  const ws = new FoamWorkspace().set(noteA).set(noteB);

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

  it('generates a link to a section within the note', () => {
    expect(md.render(`[[#sec]]`)).toEqual(
      `<p><a class='foam-note-link' title='sec' href='#sec' data-href='#sec'>#sec</a></p>\n`
    );
    expect(md.render(`[[#Section Name]]`)).toEqual(
      `<p><a class='foam-note-link' title='Section Name' href='#section-name' data-href='#section-name'>#Section Name</a></p>\n`
    );
  });

  it('generates a link to a note with a specific section', () => {
    expect(md.render(`[[note-b#sec2]]`)).toEqual(
      `<p><a class='foam-note-link' title='My second note#sec2' href='/path2/to/note-b.md#sec2' data-href='/path2/to/note-b.md#sec2'>note-b#sec2</a></p>\n`
    );
  });

  it('generates a link to an aliased note with a specific section', () => {
    expect(md.render(`[[note-b#sec2|this note]]`)).toEqual(
      `<p><a class='foam-note-link' title='My second note#sec2' href='/path2/to/note-b.md#sec2' data-href='/path2/to/note-b.md#sec2'>this note</a></p>\n`
    );
  });

  it('generates a link to a note if the note exists, but the section does not exist', () => {
    expect(md.render(`[[note-b#nonexistentsec]]`)).toEqual(
      `<p><a class='foam-note-link' title='My second note#nonexistentsec' href='/path2/to/note-b.md#nonexistentsec' data-href='/path2/to/note-b.md#nonexistentsec'>note-b#nonexistentsec</a></p>\n`
    );
  });

  it('generates a placeholder link if the note does not exist and a section is specified', () => {
    expect(md.render(`[[placeholder#sec2]]`)).toEqual(
      `<p><a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">placeholder#sec2</a></p>\n`
    );
  });

  it('generates a placeholder link with alias if the note does not exist, but alias is given', () => {
    expect(md.render(`[[placeholder#sec2|this note]]`)).toEqual(
      `<p><a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">this note</a></p>\n`
    );
  });
});
