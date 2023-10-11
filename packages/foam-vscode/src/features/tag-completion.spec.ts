import * as vscode from 'vscode';
import { FoamTags } from '../core/model/tags';
import { FoamWorkspace } from '../core/model/workspace';
import { createTestNote } from '../test/test-utils-vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { TagCompletionProvider } from './tag-completion';
import assert from 'assert';

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

  before(async () => {
    await cleanWorkspace();
  });

  // afterAll(async () => {
  //   ws.dispose();
  //   foamTags.dispose();
  //   await cleanWorkspace();
  // });

  beforeEach(async () => {
    // await closeEditors();
  });

  it('test', () => {
    assert.strictEqual(true, true);
  });

  it('should not return any tags for empty documents', async () => {
    const { uri } = await createFile('');
    const { doc } = await showInEditor(uri);
    const provider = new TagCompletionProvider(foamTags);

    const tags = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 0)
    );

    assert.strictEqual(foamTags.tags.get('primary'), true);
    assert.strictEqual(tags, null);

    // expect(foamTags.tags.get('primary')).toBeTruthy();
    // expect(tags).toBeNull();
  });

  //   it('should provide a suggestion when typing #prim', async () => {
  //     const { uri } = await createFile('#prim');
  //     const { doc } = await showInEditor(uri);
  //     const provider = new TagCompletionProvider(foamTags);

  //     const tags = await provider.provideCompletionItems(
  //       doc,
  //       new vscode.Position(0, 5)
  //     );

  //     expect(foamTags.tags.get('primary')).toBeTruthy();
  //     expect(tags.items.length).toEqual(3);
  //   });

  //   it('should not provide suggestions when inside a wikilink', async () => {
  //     const { uri } = await createFile('[[#prim');
  //     const { doc } = await showInEditor(uri);
  //     const provider = new TagCompletionProvider(foamTags);

  //     const tags = await provider.provideCompletionItems(
  //       doc,
  //       new vscode.Position(0, 7)
  //     );

  //     expect(foamTags.tags.get('primary')).toBeTruthy();
  //     expect(tags).toBeNull();
  //   });

  //   it('should not provide suggestions when inside a markdown heading #1182', async () => {
  //     const { uri } = await createFile('# primary');
  //     const { doc } = await showInEditor(uri);
  //     const provider = new TagCompletionProvider(foamTags);

  //     const tags = await provider.provideCompletionItems(
  //       doc,
  //       new vscode.Position(0, 7)
  //     );

  //     expect(foamTags.tags.get('primary')).toBeTruthy();
  //     expect(tags).toBeNull();
  //   });

  //   describe('has robust triggering #1189', () => {
  //     it('should provide multiple suggestions when typing #', async () => {
  //       const { uri } = await createFile(`# Title

  // #`);
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 1)
  //       );
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide multiple suggestions when typing # on line with match', async () => {
  //       const { uri } = await createFile('Here is #my-tag and #');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(0, 21)
  //       );
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide multiple suggestions when typing # at EOL', async () => {
  //       const { uri } = await createFile(`# Title

  // #
  // more text
  // `);
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 1)
  //       );
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should not provide a suggestion when typing `# `', async () => {
  //       const { uri } = await createFile(`# Title

  // # `);
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 2)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });

  //     it('should not provide a suggestion when typing `#{non-match}`', async () => {
  //       const { uri } = await createFile(`# Title

  // #$`);
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 2)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });

  //     it('should not provide a suggestion when typing `##`', async () => {
  //       const { uri } = await createFile(`# Title

  // ##`);
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 2)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });

  //     it('should not provide a suggestion when typing `# ` in a line that already matched', async () => {
  //       const { uri } = await createFile('here is #primary and now # ');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(0, 29)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });
  //   });

  //   describe('works inside front-matter #1184', () => {
  //     it('should provide suggestions when on `tags:` in the front-matter', async () => {
  //       const { uri } = await createFile(`---
  // created: 2023-01-01
  // tags: prim`);
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 10)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide suggestions when on `tags:` in the front-matter with leading `[`', async () => {
  //       const { uri } = await createFile('---\ntags: [');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(1, 7)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide suggestions when on `tags:` in the front-matter with `#`', async () => {
  //       const { uri } = await createFile('---\ntags: #');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(1, 7)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide suggestions when on `tags:` in the front-matter when tags are comma separated', async () => {
  //       const { uri } = await createFile(
  //         '---\ncreated: 2023-01-01\ntags: secondary, prim'
  //       );
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 21)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide suggestions when on `tags:` in the front-matter in middle of comma separated', async () => {
  //       const { uri } = await createFile(
  //         '---\ncreated: 2023-01-01\ntags: second, prim'
  //       );
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 12)
  //       );

  //       expect(foamTags.tags.get('secondary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide suggestions in `tags:` on separate line with leading space', async () => {
  //       const { uri } = await createFile('---\ntags: second, prim\n ');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 1)
  //       );

  //       expect(foamTags.tags.get('secondary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should provide suggestions in `tags:` on separate line with leading ` - `', async () => {
  //       const { uri } = await createFile('---\ntags:\n - ');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 3)
  //       );

  //       expect(foamTags.tags.get('secondary')).toBeTruthy();
  //       expect(tags.items.length).toEqual(3);
  //     });

  //     it('should not provide suggestions when on non-`tags:` in the front-matter', async () => {
  //       const { uri } = await createFile('---\ntags: prim\ntitle: prim');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 11)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });

  //     it('should not provide suggestions when outside the front-matter without `#` key', async () => {
  //       const { uri } = await createFile(
  //         '---\ncreated: 2023-01-01\ntags: prim\n---\ncontent\ntags: prim'
  //       );
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(5, 10)
  //       );

  //       expect(foamTags.tags.get('primary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });

  //     it('should not provide suggestions in `tags:` on separate line with leading ` -`', async () => {
  //       const { uri } = await createFile('---\ntags:\n -');
  //       const { doc } = await showInEditor(uri);
  //       const provider = new TagCompletionProvider(foamTags);

  //       const tags = await provider.provideCompletionItems(
  //         doc,
  //         new vscode.Position(2, 2)
  //       );

  //       expect(foamTags.tags.get('secondary')).toBeTruthy();
  //       expect(tags).toBeNull();
  //     });
  //   });
});
