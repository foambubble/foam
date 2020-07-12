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

describe('WorkspaceManager', () => {
  it('links things correctly when added in order', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-c.md', pageC);

    const note = ws.getNoteWithLinks('page-a');
    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.clean)).toEqual(['page-b', 'page-c']);
    expect(note!.backlinks.map(n => n.clean)).toEqual(['page-b']);
  });

  it('links things correctly when added out of order', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-c.md', pageC);

    const note = ws.getNoteWithLinks('page-a');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.clean)).toEqual(['page-b', 'page-c']);
    expect(note!.backlinks.map(n => n.clean)).toEqual(['page-b']);
  });

  it('links things correctly when the original file has different capitalisation', () => {
    const ws = new WorkspaceManager('dir/');

    const original = `Link to [[new-file]]`;
    const newFile = `# New File`;

    ws.addNoteFromMarkdown('original.md', original);
    ws.addNoteFromMarkdown('New-File.md', newFile);
    
    const note = ws.getNoteWithLinks('original');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.clean)).toEqual(['new-file']);
  });

  it('links things correctly when the link has different capitalization', () => {
    const ws = new WorkspaceManager('dir/');

    const original = `Link to [[New-File]]`;
    const newFile = `# New File`;

    ws.addNoteFromMarkdown('original.md', original);
    ws.addNoteFromMarkdown('new-file.md', newFile);
    
    const note = ws.getNoteWithLinks('original');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.clean)).toEqual(['new-file']);
  });

  it('links with a loose accent match', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('original.md', `Link to [[Zoë]]`);
    ws.addNoteFromMarkdown('zoe.md', `# Zoë`);
    
    const note = ws.getNoteWithLinks('original');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.clean)).toEqual(['zoe']);
  });

  it('links to the most specific match', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('original.md', `Link to [[Zoë]]`);
    ws.addNoteFromMarkdown('zoe.md', `# Zoe`);
    ws.addNoteFromMarkdown('Zoë.md', `# Zoë`);
    
    const note = ws.getNoteWithLinks('original');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.original)).toEqual(['Zoë']);
  });

  it('backlinks with a specific accent match', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('original.md', `Link to [[Zoë]]`);
    ws.addNoteFromMarkdown('zoe.md', `# LooseZoe`);
    ws.addNoteFromMarkdown('Zoë.md', `# SpecificZoë`);
    
    const loose = ws.getNoteWithLinks('zoe');
    const specific = ws.getNoteWithLinks('Zoë');

    expect(specific!.title).toEqual('SpecificZoë');
    expect(loose!.title).toEqual('LooseZoe');
    expect(specific!.backlinks.map(n => n.clean)).toEqual(['original']);
    expect(loose!.backlinks.map(n => n.clean)).toEqual([]);

  });

  it('backlinks with a loose accent match', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('original.md', `Link to [[Zoë]]`);
    ws.addNoteFromMarkdown('zoe.md', `# Zoë`);
    
    const note = ws.getNoteWithLinks('zoe');

    expect(note).not.toBeNull();
    expect(note!.backlinks.map(n => n.clean)).toEqual(['original']);
  });

  it('updates document content', () => {

    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('simple.md', `This content will be updated`);
    const before = ws.getNoteWithLinks('simple')!.markdown;
    
    ws.addNoteFromMarkdown('simple.md', `This content has been updated`);
    const after = ws.getNoteWithLinks('simple')!.markdown;

    expect(before).not.toEqual(after);
  });
  it('Updates can update forward links', () => {
    const ws = new WorkspaceManager('dir/');
    
    ws.addNoteFromMarkdown('changeme.md', `I have an [[old]] link`);
    ws.addNoteFromMarkdown('old.md', `#Old`);
    ws.addNoteFromMarkdown('new.md', `#New`);

    const before = ws.getNoteWithLinks('changeme')!
                     .linkedNotes.map(n => n.clean);
    
    // change document
    ws.addNoteFromMarkdown('changeme.md', `I have a [[new]] link`)

    const after = ws.getNoteWithLinks('changeme')!
                    .linkedNotes.map(n => n.clean);
    
    expect(before).not.toEqual(after);
    expect(after).toEqual(['new']);
  });

  it('Updates can update back links', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('has-link.md', `Link to [[referenced]] file`);
    ws.addNoteFromMarkdown('referenced.md', `#Referenced`);
    ws.addNoteFromMarkdown('add-link.md', `Will add a link to the referenced file`);

    const before = ws.getNoteWithLinks('referenced')!
                     .backlinks.map(n => n.clean);
    
    // change document
    ws.addNoteFromMarkdown('add-link.md', `Now also links to the [[referenced]] file`)

    const after = ws.getNoteWithLinks('referenced')!
                    .backlinks.map(n => n.clean);
    
    expect(before).not.toEqual(after);
    expect(after).toEqual(['has-link', 'add-link']);
  });
  
  it('updates links correctly when page is removed', () => {
    const ws = new WorkspaceManager('dir/');

    ws.addNoteFromMarkdown('page-a.md', pageA);
    ws.addNoteFromMarkdown('page-b.md', pageB);
    ws.addNoteFromMarkdown('page-c.md', pageC);


    ws.removeNote('page-c');

    const note = ws.getNoteWithLinks('page-a');

    expect(note).not.toBeNull();
    expect(note!.linkedNotes.map(n => n.clean)).toEqual(['page-b']);
    expect(note!.backlinks.map(n => n.clean)).toEqual(['page-b']);
  });
  
});
