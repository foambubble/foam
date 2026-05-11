/* @unit-ready */
import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '@foam/core';
import { createMarkdownParser } from '@foam/core';
import {
  createFile,
  deleteFile,
  withModifiedFoamConfiguration,
} from '../../../test/test-utils-vscode';
import {
  default as markdownItWikilinkEmbed,
  CONFIG_EMBED_NOTE_TYPE,
} from './wikilink-embed';

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

  it('should display a warning in case of cyclical inclusions', async () => {
    const noteA = await createFile(
      'This is the text of note A which includes ![[note-b]]',
      ['preview', 'note-a.md']
    );

    const noteBText = 'This is the text of note B which includes ![[note-a]]';
    const noteB = await createFile(noteBText, ['preview', 'note-b.md']);

    // Use the notes' parent dir as the workspace root so the absolute-path
    // embed wikilinks emitted internally resolve correctly.
    const ws = new FoamWorkspace([noteA.uri.getDirectory()])
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

  it('should render only the block content when embedding a block anchor in full inline mode', async () => {
    const note = await createFile(
      `First paragraph

Second paragraph ^target-block

Third paragraph`,
      ['note-with-block.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);
        const res = md.render(`![[note-with-block#^target-block]]`);
        expect(res).toContain('Second paragraph');
        expect(res).not.toContain('First paragraph');
        expect(res).not.toContain('Third paragraph');
        // Block anchor marker should be stripped
        expect(res).not.toContain('^target-block');
      }
    );

    await deleteFile(note);
  });

  it('should render only the block content when embedding a block anchor in content inline mode', async () => {
    const note = await createFile(
      `First paragraph

Second paragraph ^target-block

Third paragraph`,
      ['note-with-block-content.md']
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(note.uri, note.content));

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'content-inline',
      () => {
        const md = markdownItWikilinkEmbed(MarkdownIt(), ws, parser);
        const res = md.render(`![[note-with-block-content#^target-block]]`);
        expect(res).toContain('Second paragraph');
        expect(res).not.toContain('First paragraph');
        expect(res).not.toContain('Third paragraph');
        expect(res).not.toContain('^target-block');
      }
    );

    await deleteFile(note);
  });

  it('should embed a section from the current note using a self-referencing link', async () => {
    const note = await createFile(
      `# Section 1
Content of section one.

# Section 2
Content of section two.`,
      ['self-ref-section.md']
    );
    const parser = createMarkdownParser([]);
    const parsedNote = parser.parse(note.uri, note.content);
    const ws = new FoamWorkspace().set(parsedNote);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        const md = markdownItWikilinkEmbed(
          MarkdownIt(),
          ws,
          parser,
          () => parsedNote
        );
        const res = md.render(`Intro. ![[#Section 2]]`);
        expect(res).toContain('Content of section two');
        expect(res).not.toContain('Content of section one');
      }
    );

    await deleteFile(note);
  });

  it('should embed a block from the current note using a self-referencing block anchor link', async () => {
    const note = await createFile(
      `First paragraph

Target block ^self-block

Third paragraph`,
      ['self-ref-block.md']
    );
    const parser = createMarkdownParser([]);
    const parsedNote = parser.parse(note.uri, note.content);
    const ws = new FoamWorkspace().set(parsedNote);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-inline',
      () => {
        const md = markdownItWikilinkEmbed(
          MarkdownIt(),
          ws,
          parser,
          () => parsedNote
        );
        const res = md.render(`Intro. ![[#^self-block]]`);
        expect(res).toContain('Target block');
        expect(res).not.toContain('First paragraph');
        expect(res).not.toContain('Third paragraph');
        expect(res).not.toContain('^self-block');
      }
    );

    await deleteFile(note);
  });

  it('resolves a self-referencing block embed inside a transitively embedded note (issue #1642)', async () => {
    // Note A embeds note B. Note B contains `![[#^target]]`, which is a
    // self-reference to a block in B itself. The current-note context must
    // follow the embed chain — when we resolve B's self-ref, "current note"
    // should be B, not the editor's active note (A).
    const noteB = await createFile(
      `Intro of B.

The actual target block in B ^target

![[#^target]]
`,
      ['issue-1642-nested', 'note-b.md']
    );
    const noteA = await createFile(
      `Note A header.

![[note-b]]
`,
      ['issue-1642-nested', 'note-a.md']
    );

    const localParser = createMarkdownParser([]);
    const parsedA = localParser.parse(noteA.uri, noteA.content);
    const parsedB = localParser.parse(noteB.uri, noteB.content);

    const ws = new FoamWorkspace([noteA.uri.getDirectory()])
      .set(parsedA)
      .set(parsedB);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-card',
      () => {
        // Active editor is A — that's the only thing getCurrentResource
        // can see. The embed of B must establish B as the current-note
        // context for resolving B's `![[#^target]]`.
        const md = markdownItWikilinkEmbed(
          MarkdownIt(),
          ws,
          localParser,
          () => parsedA
        );
        const res = md.render(noteA.content);
        expect(res).toContain('The actual target block in B');
        // The self-ref inside B must NOT fall back to A's context.
        // Symptoms of the bug: (1) "Note A header." appears twice because
        // A's full content got rendered as the inner embed, (2) a cyclic
        // link warning is emitted because the inner embed re-resolved to A.
        expect(res).not.toContain('Cyclic link detected');
        const noteAHeaderOccurrences = (res.match(/Note A header\./g) ?? [])
          .length;
        expect(noteAHeaderOccurrences).toBe(1);
        // The literal markdown should also not survive (the embed should
        // render successfully, not fall through to the bare text).
        expect(res).not.toContain('![[#^target]]');
      }
    );

    await deleteFile(noteA);
    await deleteFile(noteB);
  });

  it('uses the factory-supplied markdown-it for embedded content so Foam plugins apply inside embeds (issue #1642)', async () => {
    // Embedded content must be rendered through the factory's markdown-it
    // (which carries the Foam plugin pipeline), not by re-entering the
    // outer instance. This test pins that contract: a custom rule
    // installed only on factory-built instances must appear in the
    // embed's output, and the outer instance (which lacks that rule)
    // must not be used for the inner render.
    const source = await createFile(
      `Outer paragraph.

A paragraph block ^target
`,
      ['issue-1642-plugins', 'source.md']
    );

    const localParser = createMarkdownParser([]);
    const parsedSource = localParser.parse(source.uri, source.content);
    const ws = new FoamWorkspace([source.uri.getDirectory()]).set(parsedSource);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-card',
      () => {
        // Outer instance has NO probe. The inner factory installs the probe
        // on every fresh instance — simulating the production setup where
        // index.ts re-runs the Foam plugin pipeline on each factory call.
        const outerMd = MarkdownIt();
        const createInnerMd = () => {
          const inner = MarkdownIt({ html: true });
          inner.renderer.rules.paragraph_open = () =>
            '<p class="inner-probe">';
          return inner;
        };

        markdownItWikilinkEmbed(
          outerMd,
          ws,
          localParser,
          () => parsedSource,
          createInnerMd
        );

        const res = outerMd.render(`Outer paragraph. ![[source#^target]]`);

        // The outer paragraph went through outerMd (no probe).
        expect(res).not.toMatch(/<p class="inner-probe">Outer paragraph/);
        // The embedded paragraph MUST go through the factory-built inner
        // instance — the probe rule should mark "A paragraph block".
        expect(res).toMatch(/<p class="inner-probe">A paragraph block/);
      }
    );

    await deleteFile(source);
  });

  it('emits the embed wrapper as raw HTML rather than escaped text (issue #1642)', async () => {
    // The card/inline formatters wrap embedded content in
    // `<div class="embed-container-note">...</div>`. When rendered through
    // the inner markdown-it factory, that block-level HTML must survive
    // intact — not be escaped as text in the final preview output.
    const source = await createFile(
      `Mix dry ingredients thoroughly ^dry-step

Add wet ingredients ^wet-step

![[#^wet-step]]
`,
      ['issue-1642-raw-html.md']
    );
    const localParser = createMarkdownParser([]);
    const parsedSource = localParser.parse(source.uri, source.content);
    const ws = new FoamWorkspace([source.uri.getDirectory()]).set(parsedSource);

    await withModifiedFoamConfiguration(
      CONFIG_EMBED_NOTE_TYPE,
      'full-card',
      () => {
        // Use a factory matching production (html: true) so the inner
        // render preserves the wrapper div. Without `html: true` the
        // inner render escapes `<div>` to `&lt;div&gt;` and the user sees
        // literal HTML tags in the preview.
        const md = markdownItWikilinkEmbed(
          MarkdownIt(),
          ws,
          localParser,
          () => parsedSource,
          () => MarkdownIt({ html: true })
        );
        const res = md.render(source.content);

        // The wrapper must appear as a real HTML element, not as escaped text.
        expect(res).toContain('<div class="embed-container-note">');
        expect(res).not.toContain('&lt;div class=&quot;embed-container-note');
      }
    );

    await deleteFile(source);
  });
});
