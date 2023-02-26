import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace';
import { createMarkdownParser } from '../../core/services/markdown-parser';
import {
  createFile,
  deleteFile,
  withModifiedFoamConfiguration,
} from '../../test/test-utils-vscode';
import {
  default as markdownItWikilinkEmbed,
  CONFIG_EMBED_NOTE_IN_CONTAINER,
} from './wikilink-embed';

const parser = createMarkdownParser();

describe('Displaying included notes in preview', () => {
  it('should render an included note in flat mode', async () => {
    const note = await createFile('This is the text of note A', [
      'preview',
      'note-a.md',
    ]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_IN_CONTAINER,
      false,
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws);

        expect(
          md.render(`This is the root node. 
  
   ![[note-a]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><p>This is the text of note A</p>
</p>`
        );
      }
    );
    await deleteFile(note);
  });

  it('should render an included note in container mode', async () => {
    const note = await createFile('This is the text of note A', [
      'preview',
      'note-a.md',
    ]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_IN_CONTAINER,
      true,
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws);

        const res = md.render(`This is the root node. ![[note-a]]`);
        expect(res).toContain('This is the root node');
        expect(res).toContain('embed-container-note');
        expect(res).toContain('This is the text of note A');
      }
    );
    await deleteFile(note);
  });

  it('should render an included section', async () => {
    // here we use createFile as the test note doesn't fill in
    // all the metadata we need
    const note = await createFile(
      `
# Section 1
This is the first section of note E

# Section 2 
This is the second section of note E

# Section 3
This is the third section of note E
    `,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
    const md = markdownItWikilinkEmbed(MarkdownIt(), ws);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_IN_CONTAINER,
      false,
      () => {
        expect(
          md.render(`This is the root node. 

 ![[note-e#Section 2]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><h1>Section 2</h1>
<p>This is the second section of note E</p>
</p>`
        );
      }
    );

    await deleteFile(note);
  });

  it('should render an included section in container mode', async () => {
    const note = await createFile(
      `
# Section 1
This is the first section of note E

# Section 2 
This is the second section of note E

# Section 3
This is the third section of note E
    `,
      ['note-e-container.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_IN_CONTAINER,
      true,
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws);

        const res = md.render(
          `This is the root node. ![[note-e-container#Section 3]]`
        );
        expect(res).toContain('This is the root node');
        expect(res).toContain('embed-container-note');
        expect(res).toContain('Section 3');
        expect(res).toContain('This is the third section of note E');
      }
    );

    await deleteFile(note);
  });

  it('should fallback to the bare text when the note is not found', () => {
    const md = markdownItWikilinkEmbed(MarkdownIt(), new FoamWorkspace());

    expect(md.render(`This is the root node. ![[non-existing-note]]`)).toMatch(
      `<p>This is the root node. ![[non-existing-note]]</p>`
    );
  });

  it('should display a warning in case of cyclical inclusions', async () => {
    const noteA = await createFile(
      'This is the text of note A which includes ![[note-b]]',
      ['preview', 'note-a.md']
    );

    const noteBText = 'This is the text of note B which includes ![[note-a]]';
    const noteB = await createFile(noteBText, ['preview', 'note-b.md']);

    const ws = new FoamWorkspace()
      .set(parser.parse(noteA.uri, noteA.content))
      .set(parser.parse(noteB.uri, noteB.content));
    const md = markdownItWikilinkEmbed(MarkdownIt(), ws);
    const res = md.render(noteBText);

    expect(res).toContain('This is the text of note B which includes');
    expect(res).toContain('This is the text of note A which includes');
    expect(res).toContain('Cyclic link detected for wikilink');

    deleteFile(noteA);
    deleteFile(noteB);
  });
});
