import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamWorkspace } from '../core/model/workspace';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { toVsCodeUri } from '../utils/vsc-utils';
import { updateDiagnostics, IdentifierResolver } from './wikilink-diagnostics';

describe('Wikilink diagnostics', () => {
  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });
  it('should show no warnings when there are no conflicts', async () => {
    const fileA = await createFile('This is the todo file');
    const fileB = await createFile(`This is linked to [[${fileA.name}]]`);

    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should show no warnings in non-md files', async () => {
    const fileA = await createFile('This is the todo file', [
      'project',
      'car',
      'todo.md',
    ]);
    const fileB = await createFile('This is the todo file', [
      'another',
      'todo.md',
    ]);
    const fileC = await createFile('Link in JS file to [[todo]]', [
      'path',
      'file.js',
    ]);

    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content))
      .set(parser.parse(fileC.uri, fileC.content));

    await showInEditor(fileC.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should show a warning when a link cannot be resolved', async () => {
    const fileA = await createFile('This is the todo file', [
      'project',
      'car',
      'todo.md',
    ]);
    const fileB = await createFile('This is the todo file', [
      'another',
      'todo.md',
    ]);
    const fileC = await createFile('Link to [[todo]]');

    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content))
      .set(parser.parse(fileC.uri, fileC.content));

    await showInEditor(fileC.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(1);
    const items = collection.get(vscode.window.activeTextEditor.document.uri);
    expect(items.length).toEqual(1);
    expect(items[0].range).toEqual(new vscode.Range(0, 8, 0, 16));
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    expect(
      items[0].relatedInformation.map(info => info.location.uri.path)
    ).toEqual([fileB.uri.path, fileA.uri.path]);
  });
});

describe('Section diagnostics', () => {
  it('should show nothing on placeholders', async () => {
    const file = await createFile('Link to [[placeholder]]');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });
  it('should show nothing when the section is correct', async () => {
    const fileA = await createFile(
      `
# Section 1
Content of section 1

# Section 2
Content of section 2
`,
      ['my-file.md']
    );
    const fileB = await createFile('Link to [[my-file#Section 1]]');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });
  it('should show a warning when the section name is incorrect', async () => {
    const fileA = await createFile(
      `
# Section 1
Content of section 1

# Section 2
Content of section 2
`
    );
    const fileB = await createFile(`Link to [[${fileA.name}#Section 10]]`);
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(1);
    const items = collection.get(toVsCodeUri(fileB.uri));
    expect(items[0].range).toEqual(new vscode.Range(0, 15, 0, 26));
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    expect(items[0].relatedInformation.map(info => info.message)).toEqual([
      'Section 1',
      'Section 2',
    ]);
  });
});

describe('Block diagnostics', () => {
  it('should show no warning when block anchor exists', async () => {
    const fileA = await createFile('A paragraph ^myblock', [
      'note-with-block.md',
    ]);
    const fileB = await createFile(`Link to [[${fileA.name}#^myblock]]`);
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should show a warning when block anchor does not exist', async () => {
    const fileA = await createFile('A paragraph ^existing', [
      'note-for-block-diag.md',
    ]);
    const fileB = await createFile(`Link to [[${fileA.name}#^ghost]]`);
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(1);
    const items = collection.get(toVsCodeUri(fileB.uri));
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    expect(items[0].relatedInformation.map(info => info.message)).toEqual([
      '^existing',
    ]);
  });

  it('should show nothing on placeholders with block anchors', async () => {
    const file = await createFile('Link to [[nonexistent#^ghost]]');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    // No diagnostic when the note itself doesn't exist (placeholder)
    expect(countEntries(collection)).toEqual(0);
  });

  it('should generate a quick-fix that preserves the # when correcting a block anchor', async () => {
    const fileA = await createFile('A paragraph ^existing', [
      'note-for-quickfix.md',
    ]);
    const fileB = await createFile(`Link to [[${fileA.name}#^ghost]]`);
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );

    const diagnostics = collection.get(toVsCodeUri(fileB.uri));
    expect(diagnostics).toHaveLength(1);

    const resolver = new IdentifierResolver('.md');
    const actions = resolver.provideCodeActions(
      vscode.window.activeTextEditor.document,
      diagnostics[0].range,
      { diagnostics, only: null } as vscode.CodeActionContext,
      null
    );

    expect(actions).toHaveLength(1);
    const editArgs = actions[0].command.arguments[0];
    // The value to replace with should be the block ID including ^
    expect(editArgs.value).toBe('^existing');
    // The replacement range should start AFTER the # (at the ^ character)
    // and end BEFORE the closing ]]
    const hashPos = `Link to [[${fileA.name}`.length;
    expect(editArgs.range.start.character).toBe(hashPos + 1); // after #
    expect(editArgs.range.end.character).toBe(
      `Link to [[${fileA.name}#^ghost]]`.length - 2
    ); // before ]]

    await vscode.window.activeTextEditor.edit(builder => {
      builder.replace(editArgs.range, editArgs.value);
    });

    expect(vscode.window.activeTextEditor.document.getText()).toBe(
      `Link to [[${fileA.name}#^existing]]`
    );
  });

  it('should preserve the # when correcting a block anchor in an escaped wikilink target', async () => {
    const fileA = await createFile('A paragraph ^existing', [
      'Note with spaces.md',
    ]);
    const escapedTarget = 'Note\\ with\\ spaces';
    const fileB = await createFile(`Link to [[${escapedTarget}#^ghost]]`);
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );

    const diagnostics = collection.get(toVsCodeUri(fileB.uri));
    expect(diagnostics).toHaveLength(1);

    const resolver = new IdentifierResolver('.md');
    const actions = resolver.provideCodeActions(
      vscode.window.activeTextEditor.document,
      diagnostics[0].range,
      { diagnostics, only: null } as vscode.CodeActionContext,
      null
    );

    expect(actions).toHaveLength(1);
    const editArgs = actions[0].command.arguments[0];

    await vscode.window.activeTextEditor.edit(builder => {
      builder.replace(editArgs.range, editArgs.value);
    });

    expect(vscode.window.activeTextEditor.document.getText()).toBe(
      `Link to [[${escapedTarget}#^existing]]`
    );
  });

  it('should preserve the alias when correcting a block anchor', async () => {
    const fileA = await createFile('A paragraph ^existing', [
      'note-for-alias-quickfix.md',
    ]);
    const fileB = await createFile(`Link to [[${fileA.name}#^ghost|My Label]]`);
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    await showInEditor(fileB.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );

    const diagnostics = collection.get(toVsCodeUri(fileB.uri));
    expect(diagnostics).toHaveLength(1);

    const resolver = new IdentifierResolver('.md');
    const actions = resolver.provideCodeActions(
      vscode.window.activeTextEditor.document,
      diagnostics[0].range,
      { diagnostics, only: null } as vscode.CodeActionContext,
      null
    );

    expect(actions).toHaveLength(1);
    const editArgs = actions[0].command.arguments[0];

    await vscode.window.activeTextEditor.edit(builder => {
      builder.replace(editArgs.range, editArgs.value);
    });

    expect(vscode.window.activeTextEditor.document.getText()).toBe(
      `Link to [[${fileA.name}#^existing|My Label]]`
    );
  });
});

describe('Duplicate block ID diagnostics', () => {
  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  it('should show no warning when all block IDs in a file are unique', async () => {
    const file = await createFile('Para one ^block1\n\nPara two ^block2\n');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should warn only on the duplicate (2nd+) occurrence, not the first', async () => {
    const file = await createFile('Para one ^myblock\n\nPara two ^myblock\n');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    const items = collection.get(vscode.window.activeTextEditor.document.uri);
    // Only the 2nd occurrence is flagged
    expect(items).toHaveLength(1);
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    // Related info points to the first occurrence
    expect(items[0].relatedInformation).toHaveLength(1);
  });

  it('should highlight the ^id text on the duplicate line', async () => {
    const file = await createFile('First ^dup\n\nSecond ^dup\n');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    const items = collection.get(vscode.window.activeTextEditor.document.uri);
    expect(items).toHaveLength(1);
    // Duplicate is the second paragraph (line 2)
    expect(items[0].range.start.line).toBe(2);
    // Range covers '^dup' (4 chars)
    expect(items[0].range.end.character - items[0].range.start.character).toBe(
      4
    );
  });

  it('should not show a warning for a list item with a unique block ID', async () => {
    const file = await createFile('- Item one ^listblock\n- Item two\n');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should not show a warning for a list item with nested subitems', async () => {
    const file = await createFile('- this is item ^listblock\n  - subitem\n');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should offer a "Replace with new ID" quick fix for each duplicate', async () => {
    const file = await createFile('Para one ^dup\n\nPara two ^dup\n');
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    const diagnostics = Array.from(
      collection.get(vscode.window.activeTextEditor.document.uri) ?? []
    );
    expect(diagnostics).toHaveLength(1);

    const resolver = new IdentifierResolver('.md');
    const actions = resolver.provideCodeActions(
      vscode.window.activeTextEditor.document,
      diagnostics[0].range,
      { diagnostics, only: null } as unknown as vscode.CodeActionContext,
      null
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe('Replace with new ID');
    expect(actions[0].command.arguments[0].value).toMatch(/^\^[a-z0-9]+$/);
  });

  it('should warn about duplicate block IDs on list items that have nested subitems', async () => {
    // The ^id anchor appears on the list item's start line (line 0), while the
    // block range.end points to the last nested subitem (line 1). The diagnostic
    // must still find the anchor and highlight it on the correct line.
    const file = await createFile(
      '- first item ^dup\n  - subitem\n\n- second item ^dup\n'
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    const items = collection.get(vscode.window.activeTextEditor.document.uri);
    // Only the 2nd occurrence should be flagged
    expect(items).toHaveLength(1);
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    // The duplicate is the second list item (line 3, 0-based)
    expect(items[0].range.start.line).toBe(3);
    // Range covers '^dup' (4 chars)
    expect(items[0].range.end.character - items[0].range.start.character).toBe(
      4
    );
  });

  it('should not flag blocks when only one occurrence exists', async () => {
    const file = await createFile(
      'Para one ^alpha\n\nPara two ^beta\n\nPara three ^alpha-variant\n'
    );
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace().set(parser.parse(file.uri, file.content));

    await showInEditor(file.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });
});

const countEntries = (collection: vscode.DiagnosticCollection): number => {
  let count = 0;
  collection.forEach((i, diagnostics) => {
    count += diagnostics.length;
  });
  return count;
};
