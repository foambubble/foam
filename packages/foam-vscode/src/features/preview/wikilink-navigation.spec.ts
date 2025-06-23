import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace';
import { createTestNote } from '../../test/test-utils';
import { markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { URI } from '../../core/model/uri';

describe('Link generation in preview', () => {
  const workspaceRoot = URI.file('/path/to/workspace');
  const workspaceRootVsCode = vscode.Uri.file('/path/to/workspace');

  beforeEach(() => {
    jest
      .spyOn(vscode.workspace, 'asRelativePath')
      .mockImplementation((pathOrUri: string | vscode.Uri) => {
        const path =
          pathOrUri instanceof vscode.Uri
            ? pathOrUri.path
            : pathOrUri.toString();
        if (path.startsWith(workspaceRootVsCode.path)) {
          // get path relative to workspace root, remove leading slash
          return path.substring(workspaceRootVsCode.path.length + 1);
        }
        return path;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const noteA = createTestNote({
    uri: '/path/to/workspace/note-a.md',
    title: 'My note title',
    links: [{ slug: 'placeholder' }],
  });
  const noteB = createTestNote({
    uri: '/path/to/workspace/path2/to/note-b.md',
    title: 'My second note',
    sections: ['sec1', 'sec2'],
  });
  const ws = new FoamWorkspace().set(noteA).set(noteB);

  const md = MarkdownIt();
  markdownItWikilinkNavigation(md, ws, { root: workspaceRootVsCode });
  markdownItRemoveLinkReferences(md, ws);

  it('generates a link to a note using the note title as link', () => {
    expect(md.render(`[[note-a]]`)).toEqual(
      `<p><a class='foam-note-link' title='${noteA.title}' href='/note-a.md' data-href='/note-a.md'>${noteA.title}</a></p>\n`
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
      `<p><a class='foam-note-link' title='${noteA.title}' href='/note-a.md' data-href='/note-a.md'>${noteA.title}</a>\n[note-a]: &lt;note-a.md&gt; &quot;Note A&quot;</p>\n`
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
      `<p><a class='foam-note-link' title='My second note#sec2' href='/path2/to/note-b.md#sec2' data-href='/path2/to/note-b.md#sec2'>My second note#sec2</a></p>\n`
    );
  });

  it('generates a link to an aliased note with a specific section', () => {
    expect(md.render(`[[note-b#sec2|this note]]`)).toEqual(
      `<p><a class='foam-note-link' title='My second note#sec2' href='/path2/to/note-b.md#sec2' data-href='/path2/to/note-b.md#sec2'>this note</a></p>\n`
    );
  });

  it('generates a link to a note if the note exists, but the section does not exist', () => {
    expect(md.render(`[[note-b#nonexistentsec]]`)).toEqual(
      `<p><a class='foam-note-link' title='My second note#nonexistentsec' href='/path2/to/note-b.md#nonexistentsec' data-href='/path2/to/note-b.md#nonexistentsec'>My second note#nonexistentsec</a></p>\n`
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
