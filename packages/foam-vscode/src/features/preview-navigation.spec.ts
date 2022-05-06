import MarkdownIt from 'markdown-it';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamWorkspace } from '../core/model/workspace';
import { createTestNote } from '../test/test-utils';
import {
  createFile,
  deleteFile,
  getUriInWorkspace,
} from '../test/test-utils-vscode';
import {
  markdownItWithFoamLinks,
  markdownItWithFoamTags,
  markdownItWithNoteInclusion,
  markdownItWithRemoveLinkReferences,
} from './preview-navigation';

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
    markdownItWithFoamLinks,
    markdownItWithRemoveLinkReferences,
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

describe('Stylable tag generation in preview', () => {
  const md = markdownItWithFoamTags(MarkdownIt(), new FoamWorkspace());

  it('transforms a string containing multiple tags to a stylable html element', () => {
    expect(md.render(`Lorem #ipsum dolor #sit`)).toMatch(
      `<p>Lorem <span class='foam-tag'>#ipsum</span> dolor <span class='foam-tag'>#sit</span></p>`
    );
  });

  it('transforms a string containing a tag with dash', () => {
    expect(md.render(`Lorem ipsum dolor #si-t`)).toMatch(
      `<p>Lorem ipsum dolor <span class='foam-tag'>#si-t</span></p>`
    );
  });
});

describe('Displaying included notes in preview', () => {
  it('should render an included note', () => {
    const note = createTestNote({
      uri: 'note-a.md',
      text: 'This is the text of note A',
    });
    const ws = new FoamWorkspace().set(note);
    const md = markdownItWithNoteInclusion(MarkdownIt(), ws);

    expect(
      md.render(`This is the root node. 

 ![[note-a]]`)
    ).toMatch(
      `<p>This is the root node.</p>
<p><p>This is the text of note A</p>
</p>`
    );
  });

  it('should render an included section', async () => {
    // here we use createFile as the test note doesn't fill in
    // all the metadata we need
    const note = await createFile(
      `
# Section 1
This is the first section of note D

# Section 2 
This is the second section of note D

# Section 3
This is the third section of note D
    `,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
    const md = markdownItWithNoteInclusion(MarkdownIt(), ws);

    expect(
      md.render(`This is the root node. 

 ![[note-e#Section 2]]`)
    ).toMatch(
      `<p>This is the root node.</p>
<p><h1>Section 2</h1>
<p>This is the second section of note D</p>
</p>`
    );

    await deleteFile(note);
  });

  it('should fallback to the bare text when the note is not found', () => {
    const md = markdownItWithNoteInclusion(MarkdownIt(), new FoamWorkspace());

    expect(md.render(`This is the root node. ![[non-existing-note]]`)).toMatch(
      `<p>This is the root node. ![[non-existing-note]]</p>`
    );
  });

  it('should display a warning in case of cyclical inclusions', () => {
    const noteA = createTestNote({
      uri: 'note-a.md',
      text: 'This is the text of note A which includes ![[note-b]]',
    });
    const noteB = createTestNote({
      uri: 'note-b.md',
      text: 'This is the text of note B which includes ![[note-a]]',
    });
    const ws = new FoamWorkspace().set(noteA).set(noteB);
    const md = markdownItWithNoteInclusion(MarkdownIt(), ws);

    expect(md.render(noteB.source.text)).toMatch(
      `<p>This is the text of note B which includes <p>This is the text of note A which includes <p>This is the text of note B which includes <div class="foam-cyclic-link-warning">Cyclic link detected for wikilink: note-a</div></p>
</p>
</p>
`
    );
  });
});
