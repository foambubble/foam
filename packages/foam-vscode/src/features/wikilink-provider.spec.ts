import { createMarkdownParser, FoamWorkspace, Range } from 'foam-core';
import * as vscode from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  createTestWorkspace,
  showInEditor,
} from '../test/test-utils';
import { OPEN_COMMAND } from './utility-commands';
import { findFirstLineOfContent, WikilinkProvider } from './wikilink-provider';

describe('findFirstLineOfContent', () => {
  it('Should return first line if content start at first line', () => {
    const content =
      'First line 123\n' + // 14 characters
      'second line\n' +
      'third line\n' +
      'last line';
    expect(findFirstLineOfContent(content)).toEqual(Range.create(0, 0, 0, 14));
  });

  it('Should return the first line with printable characters', () => {
    const content = `

First content on third line

Other line with content

Last line with content

`;
    expect(findFirstLineOfContent(content)).toEqual(Range.create(2, 0, 2, 27));
  });

  it('Should skip the leading and trailing white spaces', () => {
    const content =
      '\n\t First content surrounded by white spaces \t\n' +
      'Other line with content\n' +
      'Last line with content';
    expect(findFirstLineOfContent(content)).toEqual(Range.create(1, 2, 1, 42));
  });

  it('Should skip the YAML frontmatter', () => {
    const content = `---
type: feature
keywords: hello world
---

 # This is the Title #

Other line with content
Last line with content
`;
    expect(findFirstLineOfContent(content)).toEqual(Range.create(5, 1, 5, 22));
  });

  it('Should detect the first line just after the YAML frontmatter', () => {
    const content = `---
type: feature
keywords: hello world
---
 First content just after the frontmatter
Other line with content
Last line with content
`;
    expect(findFirstLineOfContent(content)).toEqual(Range.create(4, 1, 4, 41));
  });

  it('Should return an empty range at first position if content is only white-space characters', () => {
    const content = '\n  \n  \n  \t\n \t\t \n';
    expect(findFirstLineOfContent(content)).toEqual(Range.create(0, 0, 0, 0));
  });
});

describe('Wikilink Provider', () => {
  const activate_goToDefinition_forCreation = () => 'goToDefinition';
  const activate_openLink_forCreation = () => 'openLink';
  const disableCreationCmd = () => 'off';

  const activateNavigationCmd = () => true;
  const disableNavigationCmd = () => false;

  const noCancelToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: null,
  };

  const parser = createMarkdownParser([]);

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
  });

  test('for an empty documents should not return any link neither any reference definition', async () => {
    const { uri, content } = await createFile('');
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const doc = await vscode.workspace.openTextDocument(uri);
    const provider = new WikilinkProvider(
      ws,
      parser,
      activate_openLink_forCreation,
      activateNavigationCmd, // link
      activateNavigationCmd // definition
    );

    const links = provider.provideDocumentLinks(doc);
    expect(links.length).toEqual(0);

    const definitions = await provider.provideDefinition(
      doc,
      new vscode.Position(0, 0),
      noCancelToken
    );
    expect(definitions).toBeUndefined();
  });

  // it('should not return any link for documents without links', async () => {
  //   const { uri, content } = await createFile(
  //     'This is some content without links'
  //   );
  //   const ws = new FoamWorkspace().set(parser.parse(uri, content));

  //   const doc = await vscode.workspace.openTextDocument(uri);
  //   const provider = new LinkProvider(ws, parser);
  //   const links = provider.provideDocumentLinks(doc);

  //   expect(links.length).toEqual(0);
  // });

  test('both providers should support wikilinks', async () => {
    const fileB = await createFile('# File B');
    const fileA = await createFile(`this is a link to [[${fileB.name}]].`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const { doc } = await showInEditor(noteA.uri);
    const provider = new WikilinkProvider(
      ws,
      parser,
      activate_openLink_forCreation,
      activateNavigationCmd, // link
      activateNavigationCmd // definition
    );

    const links = provider.provideDocumentLinks(doc);
    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(OPEN_COMMAND.asURI(noteB.uri));
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 27));

    const definitions = (await provider.provideDefinition(
      doc,
      new vscode.Position(0, 20),
      noCancelToken
    )) as vscode.LocationLink[];
    expect(definitions.length).toEqual(1);
    expect(definitions[0].originSelectionRange).toEqual(
      new vscode.Range(0, 18, 0, 27)
    );
    expect(definitions[0].targetUri.path).toEqual(fileB.uri.path);
    expect(definitions[0].targetRange).toBeNull();
    expect(definitions[0].targetSelectionRange).toEqual(
      new vscode.Range(0, 0, 0, 8)
    );
  });

  // it('should support regular links', async () => {
  //   const fileB = await createFile('# File B');
  //   const fileA = await createFile(
  //     `this is a link to [a file](./${fileB.base}).`
  //   );
  //   const ws = createTestWorkspace()
  //     .set(parser.parse(fileA.uri, fileA.content))
  //     .set(parser.parse(fileB.uri, fileB.content));

  //   const { doc } = await showInEditor(fileA.uri);
  //   const provider = new LinkProvider(ws, parser);
  //   const links = provider.provideDocumentLinks(doc);

  //   expect(links.length).toEqual(1);
  //   expect(links[0].target).toEqual(OPEN_COMMAND.asURI(fileB.uri));
  //   expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 38));
  // });

  // it('should support placeholders', async () => {
  //   const fileA = await createFile(`this is a link to [[a placeholder]].`);
  //   const ws = new FoamWorkspace().set(parser.parse(fileA.uri, fileA.content));

  //   const { doc } = await showInEditor(fileA.uri);
  //   const provider = new LinkProvider(ws, parser);
  //   const links = provider.provideDocumentLinks(doc);

  //   expect(links.length).toEqual(1);
  //   expect(links[0].target).toEqual(
  //     OPEN_COMMAND.asURI(toVsCodeUri(URI.placeholder('a placeholder')))
  //   );
  //   expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 35));
  // });

  // it('should support wikilinks that have an alias', async () => {
  //   const fileB = await createFile("# File B that's aliased");
  //   const fileA = await createFile(
  //     `this is a link to [[${fileB.name}|alias]].`
  //   );

  //   const noteA = parser.parse(fileA.uri, fileA.content);
  //   const noteB = parser.parse(fileB.uri, fileB.content);
  //   const ws = createTestWorkspace()
  //     .set(noteA)
  //     .set(noteB);

  //   const { doc } = await showInEditor(noteA.uri);
  //   const provider = new LinkProvider(ws, parser);
  //   const links = provider.provideDocumentLinks(doc);

  //   expect(links.length).toEqual(1);
  //   expect(links[0].target).toEqual(OPEN_COMMAND.asURI(noteB.uri));
  //   expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 33));
  // });

  // it('should support wikilink aliases in tables using escape character', async () => {
  //   const fileB = await createFile('# File that has to be aliased');
  //   const fileA = await createFile(`
  // | Col A | ColB |
  // | --- | --- |
  // | [[${fileB.name}\\|alias]] | test |
  //   `);
  //   const noteA = parser.parse(fileA.uri, fileA.content);
  //   const noteB = parser.parse(fileB.uri, fileB.content);
  //   const ws = createTestWorkspace()
  //     .set(noteA)
  //     .set(noteB);

  //   const { doc } = await showInEditor(noteA.uri);
  //   const provider = new LinkProvider(ws, parser);
  //   const links = provider.provideDocumentLinks(doc);

  //   expect(links.length).toEqual(1);
  //   expect(links[0].target).toEqual(OPEN_COMMAND.asURI(noteB.uri));
  // });
});
