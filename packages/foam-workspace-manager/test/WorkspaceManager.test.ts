import { WorkspaceManager } from '../src/WorkspaceManager';

const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]];
`;

const pageB = `
# Page B

This references [[page-a]]`;

const pageC = `
# Page C
`;

const updatedPageC = `
# Page C
[[page-a]]
[[page-b]]
`;

describe.skip('WorkspaceManager', () => {
  it('links things correctly when added in order', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-c.md', pageC);

    const note = ws.getNoteWithLinks('page-a');
    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.id)).toEqual(['page-b', 'page-c']);
    expect(note!.backlinks.map(n => n.id)).toEqual(['page-b']);
  });

  it('links things correctly when added out of order', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-c.md', pageC);

    const note = ws.getNoteWithLinks('page-a');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.id)).toEqual(['page-b', 'page-c']);
    expect(note!.backlinks.map(n => n.id)).toEqual(['page-b']);
  });

  it('updates links when adding a changed document', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-c.md', pageC);

    const before = ws.getNoteWithLinks('page-a');

    // change document
    ws.addNoteFromMarkdown('page-c.md', updatedPageC);

    const after = ws.getNoteWithLinks('page-a');

    expect(before).not.toEqual(after);
    expect(before!.linkedNotes.map(n => n.id)).toEqual(['page-b', 'page-c']);
    expect(before!.backlinks.map(n => n.id)).toEqual(['page-b']);

    expect(after!.linkedNotes.map(n => n.id)).toEqual(['page-b', 'page-c']);
    expect(after!.backlinks.map(n => n.id)).toEqual(['page-b', 'page-c']);
  });

  /*
  it('updates links correctly when page is removed', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-c.md', pageC);


    ws.removeNote('page-c');

    const note = ws.getNoteWithLinks('page-a');

    console.log(note);
    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.id)).toEqual(['page-b']);
    expect(note!.backlinks.map(n => n.id)).toEqual(['page-b']);
  });
  */
});
