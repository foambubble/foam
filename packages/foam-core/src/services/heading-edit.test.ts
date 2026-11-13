import {
  createNoteFromMarkdown,
  createTestWorkspace,
} from '../../test/test-utils';
import { FoamGraph } from '../model/graph';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { HeadingEdit } from './heading-edit';

describe('HeadingEdit', () => {
  describe('createRenameBlockEdits', () => {
    it('should update a wikilink with a block anchor reference', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `A paragraph ^oldblock`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `See [[note-a#^oldblock]] for details.`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameBlockEdits(
        graph,
        ws,
        noteA.uri,
        'oldblock',
        'newblock'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].uri.path).toBe('/note-b.md');
      expect(result.edits[0].edit.newText).toBe('[[note-a#^newblock]]');
    });

    it('should update a self-referencing block link within the same document', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `A paragraph ^myblock\n\nJump to [[#^myblock]].`
      );
      ws.set(noteA);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameBlockEdits(
        graph,
        ws,
        noteA.uri,
        'myblock',
        'renamedblock'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].uri.path).toBe('/note-a.md');
      expect(result.edits[0].edit.newText).toBe('[[#^renamedblock]]');
    });

    it('should not update links that reference a different block', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `Para one ^block1\n\nPara two ^block2`
      );
      const noteB = createNoteFromMarkdown('/note-b.md', `[[note-a#^block2]]`);
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameBlockEdits(
        graph,
        ws,
        noteA.uri,
        'block1',
        'renamed'
      );

      expect(result.totalOccurrences).toBe(0);
      expect(result.edits).toHaveLength(0);
    });

    it('should update block links across multiple files', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `A paragraph ^myblock`
      );
      const noteB = createNoteFromMarkdown('/note-b.md', `[[note-a#^myblock]]`);
      const noteC = createNoteFromMarkdown('/note-c.md', `[[note-a#^myblock]]`);
      ws.set(noteA).set(noteB).set(noteC);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameBlockEdits(
        graph,
        ws,
        noteA.uri,
        'myblock',
        'renamed'
      );

      expect(result.totalOccurrences).toBe(2);
      expect(result.edits).toHaveLength(2);
      const uris = result.edits.map(e => e.uri.path).sort();
      expect(uris).toEqual(['/note-b.md', '/note-c.md']);
    });

    it('should update a direct markdown link with a block anchor reference', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `A paragraph ^oldblock`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `[link text](/note-a.md#^oldblock)`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameBlockEdits(
        graph,
        ws,
        noteA.uri,
        'oldblock',
        'newblock'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].uri.path).toBe('/note-b.md');
      expect(result.edits[0].edit.newText).toContain('^newblock');
      expect(result.edits[0].edit.newText).not.toContain('^oldblock');
    });

    it('should return empty result when no backlinks reference the block', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown('/note-a.md', `A paragraph ^orphan`);
      ws.set(noteA);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameBlockEdits(
        graph,
        ws,
        noteA.uri,
        'orphan',
        'renamed'
      );

      expect(result.totalOccurrences).toBe(0);
      expect(result.edits).toHaveLength(0);
    });
  });

  describe('createRenameSectionEdits', () => {
    it('should update a wikilink with a section reference', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# Old Section

Content.
`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `See [[note-a#Old Section]] for details.`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Old Section',
        'New Section'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].uri.path).toBe('/note-b.md');
      expect(result.edits[0].edit.newText).toBe('[[note-a#New Section]]');
    });

    it('should update a self-referencing section link within the same document', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# Old Section

Jump to [[#Old Section]].
`
      );
      ws.set(noteA);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Old Section',
        'New Section'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].uri.path).toBe('/note-a.md');
      expect(result.edits[0].edit.newText).toBe('[[#New Section]]');
    });

    it('should update a direct markdown link with a section reference', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# OldSection

Content.
`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `[link text](/note-a.md#OldSection)`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'OldSection',
        'NewSection'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].uri.path).toBe('/note-b.md');
      expect(result.edits[0].edit.newText).toContain('NewSection');
      expect(result.edits[0].edit.newText).not.toContain('OldSection');
    });

    it('should update the definition line for a resolved reference-style link', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# OldSection

Content.
`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `[see more][ref1]

[ref1]: note-a#OldSection
`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'OldSection',
        'NewSection'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      const edit = result.edits[0];
      expect(edit.uri.path).toBe('/note-b.md');
      // The edit must target the definition line (line 2), not the inline link (line 0)
      expect(edit.edit.range.start.line).toBe(2);
      // The new text should be the reformatted definition with the updated URL
      expect(edit.edit.newText).toBe('[ref1]: note-a#NewSection');
      // The inline link text must not appear in the edit
      expect(edit.edit.newText).not.toContain('see more');
    });

    it('should emit a single definition edit when several reference links share one definition', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# OldSection

Content.
`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `[first][ref1] and [second][ref1]

[ref1]: note-a#OldSection
`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'OldSection',
        'NewSection'
      );

      // Both links resolve through the definition, but the definition line
      // must be rewritten exactly once — a duplicate edit corrupts the file
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0].edit.newText).toBe('[ref1]: note-a#NewSection');
      // Both links are covered by the rename
      expect(result.totalOccurrences).toBe(2);
    });

    it('should not update links that reference a different section', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# Section One

## Section Two
`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `[[note-a#Section Two]]`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Section One',
        'Section Renamed'
      );

      expect(result.totalOccurrences).toBe(0);
      expect(result.edits).toHaveLength(0);
    });

    it('should update links across multiple files', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# Old Section

Content.
`
      );
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `[[note-a#Old Section]]`
      );
      const noteC = createNoteFromMarkdown(
        '/note-c.md',
        `[[note-a#Old Section]]`
      );
      ws.set(noteA).set(noteB).set(noteC);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Old Section',
        'New Section'
      );

      expect(result.totalOccurrences).toBe(2);
      expect(result.edits).toHaveLength(2);
      const uris = result.edits.map(e => e.uri.path).sort();
      expect(uris).toEqual(['/note-b.md', '/note-c.md']);
    });

    it('should update the definition URL when a wikilink has no section in its identifier but its resolved definition references the section', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# OldSection

Content.
`
      );
      // [[note-a]] has no section in rawText; section lives only in the definition URL
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `See [[note-a]] for details.

[note-a]: note-a.md#OldSection "Note A"
`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'OldSection',
        'NewSection'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);
      const edit = result.edits[0];
      expect(edit.uri.path).toBe('/note-b.md');
      // Only the definition URL is updated; rawText [[note-a]] is left unchanged
      expect(edit.edit.range.start.line).toBe(2);
      expect(edit.edit.newText).toBe('[note-a]: note-a.md#NewSection "Note A"');
    });

    it('should update both the wikilink identifier and its definition when the identifier contains the section', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# OldSection

Content.
`
      );
      // [[note-a#OldSection]] has section in rawText; the auto-generated definition mirrors it
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `See [[note-a#OldSection]] for details.

[note-a#OldSection]: note-a.md#OldSection "Note A"
`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'OldSection',
        'NewSection'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(2);
      const wikilinkEdit = result.edits.find(e =>
        e.edit.newText.startsWith('[[')
      );
      const defEdit = result.edits.find(e => !e.edit.newText.startsWith('[['));
      expect(wikilinkEdit?.edit.newText).toBe('[[note-a#NewSection]]');
      expect(defEdit?.edit.range.start.line).toBe(2);
      expect(defEdit?.edit.newText).toBe(
        '[note-a#NewSection]: note-a.md#NewSection "Note A"'
      );
    });

    it('should update both the wikilink identifier and its definition (angle-bracket URL) when the identifier contains the section', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# Old Section

Content.
`
      );
      // noteB simulates a file where Foam has auto-generated link references
      // with the 'withExtensions' setting. Foam wraps URLs with spaces in angle
      // brackets, producing a resolved definition for the wikilink.
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        `See [[note-a#Old Section]] for details.

[note-a#Old Section]: <note-a.md#Old Section> "Note A"
`
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Old Section',
        'New Section'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(2);
      const wikilinkEdit = result.edits.find(e =>
        e.edit.newText.startsWith('[[')
      );
      const defEdit = result.edits.find(e => !e.edit.newText.startsWith('[['));
      // Must preserve 'note-a' (not 'note-a.md') as the wikilink target
      expect(wikilinkEdit?.edit.newText).toBe('[[note-a#New Section]]');
      expect(defEdit?.edit.range.start.line).toBe(2);
      expect(defEdit?.edit.newText).toBe(
        '[note-a#New Section]: <note-a.md#New Section> "Note A"'
      );
    });

    it('should return empty result when no backlinks reference the section', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        '/note-a.md',
        `# Some Section

Content.
`
      );
      ws.set(noteA);
      const graph = FoamGraph.fromWorkspace(ws);

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Some Section',
        'New Section'
      );

      expect(result.totalOccurrences).toBe(0);
      expect(result.edits).toHaveLength(0);
    });

    it('should take the links of newer copies of notes over the graph', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown('/note-a.md', '# Old Section\n');
      const noteB = createNoteFromMarkdown(
        '/note-b.md',
        'See [[note-a#Old Section]].'
      );
      ws.set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);
      const newerB = createNoteFromMarkdown(
        '/note-b.md',
        'Also see [[note-a#Old Section]].'
      );
      const newerC = createNoteFromMarkdown(
        '/note-c.md',
        '[[note-a#Old Section]]'
      );

      const result = HeadingEdit.createRenameSectionEdits(
        graph,
        ws,
        noteA.uri,
        'Old Section',
        'New Section',
        [newerB, newerC]
      );

      expect(result.edits.map(e => [e.uri.path, e.edit.range])).toEqual([
        ['/note-b.md', Range.create(0, 9, 0, 31)],
        ['/note-c.md', Range.create(0, 0, 0, 22)],
      ]);
    });
  });

  describe('getSectionAtPosition', () => {
    const noteA = () =>
      createNoteFromMarkdown(
        '/note-a.md',
        '# Old Heading\n\nA paragraph ^blk\n\nJump to [[#Old Heading]].\n'
      );
    const sectionAt = (text: string, position: Position) => {
      const a = noteA();
      const b = createNoteFromMarkdown('/note-b.md', text);
      const ws = createTestWorkspace().set(a).set(b);
      return HeadingEdit.getSectionAtPosition(ws, b, position);
    };

    it('should return the heading at the position', () => {
      const a = noteA();
      const ws = createTestWorkspace().set(a);
      const result = HeadingEdit.getSectionAtPosition(
        ws,
        a,
        Position.create(0, 5)
      );
      expect(result.target.uri).toEqual(a.uri);
      expect(result.section.label).toEqual('Old Heading');
      expect(result.range).toEqual(Range.create(0, 2, 0, 13));
    });

    it('should return the section a wikilink section points to', () => {
      const result = sectionAt(
        'See [[note-a#Old Heading]].',
        Position.create(0, 'See [[note-a#Old'.length)
      );
      const start = 'See [[note-a#'.length;
      expect(result.target.uri.path).toEqual('/note-a.md');
      expect(result.section.label).toEqual('Old Heading');
      expect(result.range).toEqual(
        Range.create(0, start, 0, start + 'Old Heading'.length)
      );
    });

    it('should resolve a section link to the same note', () => {
      const a = noteA();
      const ws = createTestWorkspace().set(a);
      const result = HeadingEdit.getSectionAtPosition(
        ws,
        a,
        Position.create(4, 'Jump to [[#Old'.length)
      );
      expect(result.target.uri).toEqual(a.uri);
      expect(result.section.label).toEqual('Old Heading');
    });

    it('should resolve an embedded, aliased wikilink', () => {
      const result = sectionAt(
        '![[note-a#Old Heading|alias]]',
        Position.create(0, '![[note-a#Old'.length)
      );
      expect(result.section.label).toEqual('Old Heading');
      expect(result.range.start.character).toEqual('![[note-a#'.length);
    });

    it('should prefer a wikilink over the heading it sits in', () => {
      const result = sectionAt(
        '# See [[note-a#Old Heading]]',
        Position.create(0, '# See [[note-a#Old'.length)
      );
      expect(result.target.uri.path).toEqual('/note-a.md');
      expect(result.section.label).toEqual('Old Heading');
    });

    it('should return undefined on the note part of a wikilink', () => {
      expect(
        sectionAt('See [[note-a#Old Heading]].', Position.create(0, 7))
      ).toBeUndefined();
    });

    it('should return undefined on a block link', () => {
      expect(
        sectionAt('See [[note-a#^blk]].', Position.create(0, 15))
      ).toBeUndefined();
    });

    it('should return undefined for a link to a missing note', () => {
      expect(
        sectionAt('See [[missing#Old Heading]].', Position.create(0, 16))
      ).toBeUndefined();
    });

    it('should return undefined for a section the linked note does not have', () => {
      expect(
        sectionAt('See [[note-a#Missing]].', Position.create(0, 15))
      ).toBeUndefined();
    });

    it('should find the section in a newer copy of the linked note', () => {
      const a = noteA();
      const b = createNoteFromMarkdown(
        '/note-b.md',
        'See [[note-a#Old Heading]].'
      );
      const ws = createTestWorkspace().set(a).set(b);
      const newerA = createNoteFromMarkdown(
        '/note-a.md',
        'Intro.\n\n# Old Heading\n'
      );

      const result = HeadingEdit.getSectionAtPosition(
        ws,
        b,
        Position.create(0, 'See [[note-a#Old'.length),
        [newerA]
      );

      expect(result.target).toBe(newerA);
      expect(result.section.labelRange).toEqual(Range.create(2, 2, 2, 13));
    });

    it('should return undefined away from headings and links', () => {
      expect(sectionAt('Body text.\n', Position.create(0, 3))).toBeUndefined();
    });
  });
});
