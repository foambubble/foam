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
  CONFIG_EMBED_NOTE_TYPE,
} from './wikilink-embed';
import { readFileFromFs, TEST_DATA_DIR } from '../../test/test-utils';

const parser = createMarkdownParser();

describe('Displaying included notes in preview', () => {
  it('should render an included note in full inline mode', async () => {
    const note = await createFile('This is the text of note A', [
      'preview',
      'note-a.md',
    ]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

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

  it('should render an included note in full card mode', async () => {
    const note = await createFile('This is the text of note A', [
      'preview',
      'note-a.md',
    ]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-card',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        const res = md.render(`This is the root node. ![[note-a]]`);
        expect(res).toContain('This is the root node');
        expect(res).toContain('embed-container-note');
        expect(res).toContain('This is the text of note A');
      }
    );
    await deleteFile(note);
  });

  it('should render an included section in full inline mode', async () => {
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
    const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
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

  it('should render an included section in full card mode', async () => {
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
      CONFIG_EMBED_NOTE_TYPE,
      'full-card',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

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

  it('should not render the title of a note in content inline mode', async () => {
    const note = await createFile(
      `
# Title
## Section 1

This is the first section of note E`,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        expect(
          md.render(`This is the root node. 
            
![[note-e]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><h2>Section 1</h2>
<p>This is the first section of note E</p>
</p>`
        );
      }
    );

    await deleteFile(note);
  });

  it('should not render the title of a note in content card mode', async () => {
    const note = await createFile(
      `# Title
## Section 1

This is the first section of note E
      `,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-card',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        const res = md.render(`This is the root node. ![[note-e.md]]`);

        expect(res).toContain('This is the root node');
        expect(res).toContain('embed-container-note');
        expect(res).toContain('Section 1');
        expect(res).toContain('This is the first section of note E');
        expect(res).not.toContain('Title');
      }
    );

    await deleteFile(note);
  });

  it('should not render the section title, but still render subsection titles in content inline mode', async () => {
    const note = await createFile(
      `# Title


## Section 1
This is the first section of note E

### Subsection a
This is the first subsection of note E
      `,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        expect(
          md.render(`This is the root node. 
              
![[note-e#Section 1]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><p>This is the first section of note E</p>
<h3>Subsection a</h3>
<p>This is the first subsection of note E</p>
</p>`
        );
      }
    );

    await deleteFile(note);
  });

  it('should not render the subsection title in content mode if you link to it and regardless of its level', async () => {
    const note = await createFile(
      `# Title
## Section 1
This is the first section of note E

### Subsection a
This is the first subsection of note E`,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        expect(
          md.render(`This is the root node. 

![[note-e#Subsection a]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><p>This is the first subsection of note E</p>
</p>`
        );
      }
    );

    await deleteFile(note);
  });

  it('should allow a note embedding type to be overridden if a modifier is passed in', async () => {
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
    const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        expect(
          md.render(`This is the root node. 

 content![[note-e#Section 2]]
 
 full![[note-e#Section 3]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><p>This is the second section of note E</p>
</p>
<p><h1>Section 3</h1>
<p>This is the third section of note E</p>
</p>
`
        );
      }
    );

    await deleteFile(note);
  });

  it('should allow a note embedding type to be overridden if two modifiers are passed in', async () => {
    const note = await createFile(
      `
# Section 1
This is the first section of note E

# Section 2 
This is the second section of note E
    `,
      ['note-e.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
    const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        const res = md.render(`This is the root node. 
 
content-card![[note-e#Section 2]]`);

        expect(res).toContain('This is the root node');
        expect(res).toContain('embed-container-note');
        expect(res).toContain('This is the second section of note E');
        expect(res).not.toContain('Section 2');
      }
    );

    await deleteFile(note);
  });

  it('should fallback to the bare text when the note is not found', () => {
    const md = markdownItWikilinkEmbed(
      MarkdownIt(),
      new FoamWorkspace(),
      parser
    );

    expect(md.render(`This is the root node. ![[non-existing-note]]`)).toMatch(
      `<p>This is the root node. ![[non-existing-note]]</p>`
    );
  });

  it('should render the bare text for an embedded note that is embedding a note that is not found', async () => {
    const note = await createFile(
      'This is the text of note A which includes ![[does-not-exist]]',
      ['note.md']
    );

    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);
        expect(md.render(`This is the root node. ![[note]]`)).toMatch(
          `<p>This is the root node. <p>This is the text of note A which includes ![[does-not-exist]]</p>
</p>`
        );
      }
    );
  });

  it.skip('should display a warning in case of cyclical inclusions', async () => {
    const noteA = await createFile(
      'This is the text of note A which includes ![[note-b]]',
      ['preview', 'note-a.md']
    );

    const noteBText = 'This is the text of note B which includes ![[note-a]]';
    const noteB = await createFile(noteBText, ['preview', 'note-b.md']);

    const ws = new FoamWorkspace()
      .set(parser.parse(noteA.uri, noteA.content))
      .set(parser.parse(noteB.uri, noteB.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-card',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);
        const res = md.render(noteBText);

        expect(res).toContain('This is the text of note B which includes');
        expect(res).toContain('This is the text of note A which includes');
        expect(res).toContain('Cyclic link detected for wikilink');
      }
    );

    await deleteFile(noteA);
    await deleteFile(noteB);
  });

  describe('Block Identifiers', () => {
    it('should correctly transclude a paragraph block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'paragraph.md')
      );
      const note = await createFile(content, [
        'block-identifiers',
        'paragraph.md',
      ]);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[paragraph#^p1]]`)).toMatch(
            `<p>This is a paragraph. ^p1</p>`
          );
        }
      );
      await deleteFile(note);
    });

    it('should correctly transclude a list item block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'list.md')
      );
      const note = await createFile(content, ['block-identifiers', 'list.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[list#^li1]]`)).toMatch(
            `<ul>
<li>list item 1 ^li1</li>
</ul>`
          );
        }
      );
      await deleteFile(note);
    });

    it('should correctly transclude a nested list item block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'list.md')
      );
      const note = await createFile(content, ['block-identifiers', 'list.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[list#^nli1]]`)).toMatch(
            `<ul>
<li>list item 2
<ul>
<li>nested list item 1 ^nli1</li>
</ul>
</li>
</ul>`
          );
        }
      );
      await deleteFile(note);
    });

    it('should correctly transclude a heading block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'heading.md')
      );
      const note = await createFile(content, [
        'block-identifiers',
        'heading.md',
      ]);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[heading#^h2]]`)).toMatch(
            `<h2>Heading 2 ^h2</h2>
<p>Some more content.</p>`
          );
        }
      );
      await deleteFile(note);
    });

    it('should correctly transclude a code block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'code-block.md')
      );
      const note = await createFile(content, [
        'block-identifiers',
        'code-block.md',
      ]);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[code-block#^cb1]]`)).toMatch(
            `<pre><code class="language-json">{
  "key": "value"
}
</code></pre>`
          );
        }
      );
      await deleteFile(note);
    });
  });
});
