import * as vscode from 'vscode';
import { FoamTags } from '../core/model/tags';
import { FoamWorkspace } from '../core/model/workspace';
import { createTestNote } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { TagCompletionProvider } from './tag-completion';

describe('Tag Completion', () => {
  const root = fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri);
  const ws = new FoamWorkspace();
  ws.set(
    createTestNote({
      root,
      uri: 'file-name.md',
      tags: ['primary'],
    })
  )
    .set(
      createTestNote({
        root,
        uri: 'File name with spaces.md',
        tags: ['secondary'],
      })
    )
    .set(
      createTestNote({
        root,
        uri: 'path/to/file.md',
        links: [{ slug: 'placeholder text' }],
        tags: ['primary', 'third'],
      })
    );
  const foamTags = FoamTags.fromWorkspace(ws);

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    ws.dispose();
    foamTags.dispose();
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
  });

  it('should not return any tags for empty documents', async () => {
    const { uri } = await createFile('');
    const { doc } = await showInEditor(uri);
    const provider = new TagCompletionProvider(foamTags);

    const tags = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 0)
    );

    expect(foamTags.tags.get('primary')).toBeTruthy();
    expect(tags).toBeNull();
  });

  it('should provide a suggestion when typing #prim', async () => {
    const { uri } = await createFile('#prim');
    const { doc } = await showInEditor(uri);
    const provider = new TagCompletionProvider(foamTags);

    const tags = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 5)
    );

    expect(foamTags.tags.get('primary')).toBeTruthy();
    expect(tags.items.length).toEqual(3);
  });

  it('should not provide suggestions when inside a wikilink', async () => {
    const { uri } = await createFile('[[#prim');
    const { doc } = await showInEditor(uri);
    const provider = new TagCompletionProvider(foamTags);

    const tags = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 7)
    );

    expect(foamTags.tags.get('primary')).toBeTruthy();
    expect(tags).toBeNull();
  });

  it('should not provide suggestions when inside a markdown heading #1182', async () => {
    const { uri } = await createFile('# primary');
    const { doc } = await showInEditor(uri);
    const provider = new TagCompletionProvider(foamTags);

    const tags = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 7)
    );

    expect(foamTags.tags.get('primary')).toBeTruthy();
    expect(tags).toBeNull();
  });

  describe('has robust triggering #1189', () => {
    it('should provide multiple suggestions when typing #', async () => {
      const { uri } = await createFile(`# Title

#`);
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(2, 1)
      );
      expect(tags.items.length).toEqual(3);
    });

    it('should provide multiple suggestions when typing # on line with match', async () => {
      const { uri } = await createFile('Here is #my-tag and #');
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(0, 21)
      );
      expect(tags.items.length).toEqual(3);
    });

    it('should provide multiple suggestions when typing # at EOL', async () => {
      const { uri } = await createFile(`# Title

#
more text
`);
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(2, 1)
      );
      expect(tags.items.length).toEqual(3);
    });

    it('should not provide a suggestion when typing `# `', async () => {
      const { uri } = await createFile(`# Title

# `);
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(2, 2)
      );

      expect(foamTags.tags.get('primary')).toBeTruthy();
      expect(tags).toBeNull();
    });

    it('should not provide a suggestion when typing `#{non-match}`', async () => {
      const { uri } = await createFile(`# Title

#$`);
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(2, 2)
      );

      expect(foamTags.tags.get('primary')).toBeTruthy();
      expect(tags).toBeNull();
    });

    it('should not provide a suggestion when typing `##`', async () => {
      const { uri } = await createFile(`# Title

##`);
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(2, 2)
      );

      expect(foamTags.tags.get('primary')).toBeTruthy();
      expect(tags).toBeNull();
    });

    it('should not provide a suggestion when typing `# ` in a line that already matched', async () => {
      const { uri } = await createFile('here is #primary and now # ');
      const { doc } = await showInEditor(uri);
      const provider = new TagCompletionProvider(foamTags);

      const tags = await provider.provideCompletionItems(
        doc,
        new vscode.Position(0, 29)
      );

      expect(foamTags.tags.get('primary')).toBeTruthy();
      expect(tags).toBeNull();
    });
  });
});
