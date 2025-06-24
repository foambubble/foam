import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace';
import { createMarkdownParser } from '../../core/services/markdown-parser';
import {
  createFile,
  deleteFile,
  withModifiedFoamConfiguration,
  cleanWorkspace,
  closeEditors,
} from '../../test/test-utils-vscode';
import {
  default as markdownItWikilinkEmbed,
  CONFIG_EMBED_NOTE_TYPE,
} from './wikilink-embed';
import { markdownItWikilinkNavigation } from './wikilink-navigation';
import { readFileFromFs, TEST_DATA_DIR } from '../../test/test-utils';
import { URI } from '../../core/model/uri';

const parser = createMarkdownParser();

describe('Displaying included notes in preview', () => {
  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  it('should embed a block from another note', async () => {
    const noteWithBlockContent = await readFileFromFs(
      TEST_DATA_DIR.joinPath('block-identifiers', 'note-with-block-id.md')
    );
    const noteWithBlock = await createFile(noteWithBlockContent, [
      'note-with-block.md',
    ]);

    const linkingNoteContent = `![[note-with-block#^block-1]]`;
    const linkingNote = await createFile(linkingNoteContent, [
      'linking-note.md',
    ]);

    const ws = new FoamWorkspace()
      .set(parser.parse(noteWithBlock.uri, noteWithBlock.content))
      .set(parser.parse(linkingNote.uri, linkingNote.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);
        const result = md.render(linkingNote.content);
        expect(result).toContain(
          '<p>This is a paragraph with a block identifier. ^block-1</p>'
        );
        expect(result).not.toContain('![[note-with-block#^block-1]]');
      }
    );

    await deleteFile(noteWithBlock.uri);
    await deleteFile(linkingNote.uri);
  });

  it('should embed a block with a link inside it', async () => {
    const noteAContent = '# Note A';
    const noteA = await createFile(noteAContent, ['note-a.md']);
    const noteWithLinkedBlockContent =
      '# Mixed Target Note\n\nHere is a paragraph with a [[note-a]]. ^para-block';
    const noteWithLinkedBlock = await createFile(noteWithLinkedBlockContent, [
      'note-with-linked-block.md',
    ]);

    const linkingNote2Content = `![[note-with-linked-block#^para-block]]`;
    const linkingNote2 = await createFile(linkingNote2Content, [
      'linking-note-2.md',
    ]);

    const ws = new FoamWorkspace()
      .set(parser.parse(noteA.uri, noteAContent))
      .set(parser.parse(noteWithLinkedBlock.uri, noteWithLinkedBlock.content))
      .set(parser.parse(linkingNote2.uri, linkingNote2.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkNavigation(
          markdownItWikilinkEmbed(MarkdownIt(), ws, parser),
          ws
        );
        const result = md.render(linkingNote2.content);
        const linkHtml = `<a class='foam-note-link' title='Note A' href='/note-a.md' data-href='/note-a.md'>Note A</a>`;
        expect(result).toContain(
          `<p>Here is a paragraph with a ${linkHtml}. ^para-block</p>`
        );
      }
    );

    await deleteFile(noteA.uri);
    await deleteFile(noteWithLinkedBlock.uri);
    await deleteFile(linkingNote2.uri);
  });

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

        expect(md.render(`This is the root node. \n  \n   ![[note-a]]`)).toBe(
          `<p>This is the root node.</p>\n<p>This is the text of note A</p>\n`
        );
      }
    );
    await deleteFile(note.uri);
  });

  it('should render an included note in full card mode', async () => {
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

        const res = md.render(`This is the root node. ![[note-a]]`);
        expect(res).toContain('This is the root node');
        expect(res).not.toContain('embed-container-note');
        expect(res).toContain('This is the text of note A');
      }
    );
    await deleteFile(note.uri);
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
          md.render(`This is the root node. \n\n ![[note-e#Section 2]]`)
        ).toMatch(
          `<p>This is the root node.</p>
<p><h1>Section 2</h1>
<p>This is the second section of note E</p>
</p>`
        );
      }
    );

    await deleteFile(note.uri);
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
      'full-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        const res = md.render(
          `This is the root node. ![[note-e-container#Section 3]]`
        );
        expect(res).toContain('This is the root node');
        expect(res).not.toContain('embed-container-note');
        expect(res).toContain('Section 3');
        expect(res).toContain('This is the third section of note E');
      }
    );

    await deleteFile(note.uri);
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

    await deleteFile(note.uri);
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
      'content-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

        const res = md.render(`This is the root node. ![[note-e.md]]`);

        expect(res).toContain('This is the root node');
        expect(res).not.toContain('embed-container-note');
        expect(res).toContain('Section 1');
        expect(res).toContain('This is the first section of note E');
        expect(res).not.toContain('Title');
      }
    );

    await deleteFile(note.uri);
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

    await deleteFile(note.uri);
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
          md.render(`This is the root node. \n\n![[note-e#Subsection a]]`)
        ).toBe(
          `<p>This is the root node.</p>\n<p>This is the first subsection of note E</p>\n`
        );
      }
    );

    await deleteFile(note.uri);
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
        ).toBe(
          `<p>This is the root node.</p>\n<p>This is the second section of note E</p>\n<p><h1>Section 3</h1>\n<p>This is the third section of note E</p>\n</p>\n`
        );
      }
    );

    await deleteFile(note.uri);
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

    await deleteFile(note.uri);
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
        expect(md.render(`This is the root node. ![[note]]`)).toBe(
          `<p>This is the root node. This is the text of note A which includes ![[does-not-exist]]</p>\n`
        );
      }
    );
    await deleteFile(note.uri);
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

    await deleteFile(noteA.uri);
    await deleteFile(noteB.uri);
  });

  describe('Block Identifiers', () => {
    it('should correctly transclude a paragraph block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'paragraph.md')
      );
      const note = await createFile(content, ['paragraph.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[paragraph#^p1]]`)).toMatch(
            `<p>This is a paragraph. ^p1</p>\n`
          );
        }
      );
      await deleteFile(note.uri);
    });

    it('should correctly transclude a list item block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'list.md')
      );
      const note = await createFile(content, ['list.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[list#^li1]]`)).toMatch(
            `<ul>\n<li>list item 1 ^li1</li>\n</ul>\n`
          );
        }
      );
      await deleteFile(note.uri);
    });

    it('should correctly transclude a nested list item block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'list.md')
      );
      const note = await createFile(content, ['list.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[list#^nli1]]`)).toMatch(
            `<ul>\n<li>nested list item 1 ^nli1</li>\n</ul>\n`
          );
        }
      );
      await deleteFile(note.uri);
    });

    it('should correctly transclude a heading block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'heading.md')
      );
      const note = await createFile(content, ['heading.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[heading#^h2]]`)).toMatch(
            `<h2>Heading 2 ^h2</h2>\n<p>Some more content.</p>\n`
          );
        }
      );
      await deleteFile(note.uri);
    });

    it('should correctly transclude a code block', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'code-block.md')
      );
      const note = await createFile(content, ['code-block.md']);
      const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));
      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);

      await withModifiedFoamConfiguration(
        CONFIG_EMBED_NOTE_TYPE,
        'full-inline',
        () => {
          expect(md.render(`![[code-block#^cb1]]`)).toMatch(
            `<pre><code class="language-json">{
  &quot;key&quot;: &quot;value&quot;
}
</code></pre>\n`
          );
        }
      );
      await deleteFile(note.uri);
    });

    it('should embed a block with links and keep them functional', async () => {
      const noteA = await createFile('# Note A\n', ['note-a.md']);
      const noteWithBlock = await createFile(
        '# Note with block\n\nThis is a paragraph with a [[note-a]] and a block identifier. ^my-linked-block',
        ['note-with-linked-block.md']
      );

      const linkingNote = await createFile(
        '# Linking note\n\nThis note embeds a block: ![[note-with-linked-block#^my-linked-block]]',
        ['linking-note.md']
      );

      const ws = new FoamWorkspace()
        .set(parser.parse(noteA.uri, noteA.content))
        .set(parser.parse(noteWithBlock.uri, noteWithBlock.content))
        .set(parser.parse(linkingNote.uri, linkingNote.content));

      const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);
      const result = md.render(linkingNote.content);

      expect(result).toContain('This is a paragraph with a');
      expect(result).toContain('note-a.md');
      expect(result).toContain('and a block identifier. ^my-linked-block');

      await deleteFile(noteA.uri);
      await deleteFile(noteWithBlock.uri);
      await deleteFile(linkingNote.uri);
    });
  });
});

describe('Mixed Scenario Embed', () => {
  it('should correctly embed a block from a note with mixed content', async () => {
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace();
    const noteAContent = '# Note A';
    const noteA = await createFile(noteAContent, ['note-a.md']);

    const mixedTargetContent =
      '# Mixed Target Note\n\nHere is a paragraph with a [[note-a]]. ^para-block\n\n- List item 1\n- List item 2 with [[note-a]] ^list-block';
    const mixedSourceContent =
      '# Mixed Source Note\n\nThis note embeds a paragraph: ![[mixed-target#^para-block]]\n\nAnd this note embeds a list item: ![[mixed-target#^list-block]]';

    const mixedTargetFile = await createFile(mixedTargetContent, [
      'mixed-target.md',
    ]);
    const mixedSourceFile = await createFile(mixedSourceContent, [
      'mixed-source.md',
    ]);

    const mixedTarget = parser.parse(mixedTargetFile.uri, mixedTargetContent);
    const mixedSource = parser.parse(mixedSourceFile.uri, mixedSourceContent);
    const noteAResource = parser.parse(noteA.uri, noteAContent);

    ws.set(mixedTarget).set(mixedSource).set(noteAResource);
    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkNavigation(
          markdownItWikilinkEmbed(MarkdownIt(), ws, parser),
          ws
        );
        const result = md.render(mixedSourceContent);

        const linkHtml = `<a class='foam-note-link' title='Note A' href='/note-a.md' data-href='/note-a.md'>Note A</a>`;

        // Check for embedded paragraph block content
        expect(result).toContain(
          `This note embeds a paragraph: Here is a paragraph with a ${linkHtml}. ^para-block`
        );

        // Check for embedded list block content
        expect(result).toContain(
          `<li>List item 2 with ${linkHtml} ^list-block</li>`
        );
      }
    );

    await deleteFile(mixedTargetFile.uri);
    await deleteFile(mixedSourceFile.uri);
    await deleteFile(noteA.uri);
  });
});
