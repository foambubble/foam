import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamWorkspace } from '../core/model/workspace';
import { URI } from '../core/model/uri';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  deleteFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { readFileFromFs, TEST_DATA_DIR } from '../test/test-utils';
import { toVsCodeUri } from '../utils/vsc-utils';
import { updateDiagnostics } from './wikilink-diagnostics';

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
    expect(items[0].range).toEqual(new vscode.Range(0, 15, 0, 28));
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    expect(items[0].relatedInformation.map(info => info.message)).toEqual([
      'Section 1',
      'Section 2',
    ]);
  });
});

describe('Block Identifier diagnostics', () => {
  it('should show nothing when the block id is correct', async () => {
    const noteWithBlockId = await createFile(
      '# Note with block id\n\nThis is a paragraph. ^block-1',
      [
        'packages',
        'foam-vscode',
        'test-data',
        'block-identifiers',
        'note-with-block-id.md',
      ]
    );
    const linkingNote = await createFile(
      `Link to [[${noteWithBlockId.name}#^block-1]]`,
      [
        'packages',
        'foam-vscode',
        'test-data',
        'block-identifiers',
        'linking-to-valid-block.md',
      ]
    );

    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(noteWithBlockId.uri, noteWithBlockId.content))
      .set(parser.parse(linkingNote.uri, linkingNote.content));

    await showInEditor(linkingNote.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(0);
  });

  it('should show a warning when the block id is incorrect', async () => {
    const noteWithBlockId = await createFile(
      '# Note with block id\n\nThis is a paragraph. ^block-1',
      [
        'packages',
        'foam-vscode',
        'test-data',
        'block-identifiers',
        'note-with-block-id.md',
      ]
    );
    const linkContent = `[[${noteWithBlockId.name}#^non-existent-block]]`;
    const fileContent = `Link to ${linkContent}`;
    const linkingNote = await createFile(fileContent, [
      'packages',
      'foam-vscode',
      'test-data',
      'block-identifiers',
      'linking-to-invalid-block.md',
    ]);

    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace()
      .set(parser.parse(noteWithBlockId.uri, noteWithBlockId.content))
      .set(parser.parse(linkingNote.uri, linkingNote.content));

    await showInEditor(linkingNote.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );
    expect(countEntries(collection)).toEqual(1);
    const items = collection.get(toVsCodeUri(linkingNote.uri));
    expect(items[0].range).toEqual(new vscode.Range(0, 28, 0, 50));
    expect(items[0].severity).toEqual(vscode.DiagnosticSeverity.Warning);
    expect(items[0].relatedInformation.map(info => info.message)).toEqual([
      'Note with block id',
      '^block-1',
    ]);
  });
});

describe('Mixed Scenario Diagnostics', () => {
  it('should report a warning for a non-existent block but not for valid links', async () => {
    const parser = createMarkdownParser([]);
    const ws = new FoamWorkspace();

    const mixedTargetContent = await readFileFromFs(
      TEST_DATA_DIR.joinPath('block-identifiers', 'mixed-target.md')
    );
    const mixedOtherContent = await readFileFromFs(
      TEST_DATA_DIR.joinPath('block-identifiers', 'mixed-other.md')
    );
    const mixedSourceContent = await readFileFromFs(
      TEST_DATA_DIR.joinPath('block-identifiers', 'mixed-source.md')
    );

    const mixedTargetFile = await createFile(mixedTargetContent, [
      'mixed-target.md',
    ]);
    const mixedOtherFile = await createFile(mixedOtherContent, [
      'mixed-other.md',
    ]);
    const mixedSourceFile = await createFile(mixedSourceContent, [
      'mixed-source.md',
    ]);

    const mixedTarget = parser.parse(mixedTargetFile.uri, mixedTargetContent);
    const mixedOther = parser.parse(mixedOtherFile.uri, mixedOtherContent);
    const mixedSource = parser.parse(mixedSourceFile.uri, mixedSourceContent);

    ws.set(mixedTarget).set(mixedOther).set(mixedSource);

    await showInEditor(mixedSource.uri);

    const collection = vscode.languages.createDiagnosticCollection('foam-test');
    updateDiagnostics(
      ws,
      parser,
      vscode.window.activeTextEditor.document,
      collection
    );

    expect(countEntries(collection)).toEqual(1);
    const items = collection.get(toVsCodeUri(mixedSource.uri));
    // The warning should be for [[mixed-target#^no-such-block]]
    // which is on line 9 (index 8) of mixed-source.md
    expect(items[0].range).toEqual(new vscode.Range(8, 44, 8, 61));
    expect(items[0].message).toContain('Cannot find section');

    await deleteFile(mixedTargetFile.uri);
    await deleteFile(mixedOtherFile.uri);
    await deleteFile(mixedSourceFile.uri);
  });
});

const countEntries = (collection: vscode.DiagnosticCollection): number => {
  let count = 0;
  collection.forEach((i, diagnostics) => {
    count += diagnostics.length;
  });
  return count;
};
