import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { createTestWorkspace } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { NavigationProvider } from './navigation-provider';
import { FoamGraph } from '../core/model/graph';
import { FoamTags } from '../core/model/tags';
import { toVsCodeUri } from '../utils/vsc-utils';

describe('Document decorator', () => {
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

  describe('links in .foam directory', () => {
    it('ctrl-click on a direct path link to an existing .foam file should open the file, not create a new note', async () => {
      const template = await createFile('Template content', [
        '.foam',
        'templates',
        'template.md',
      ]);
      const noteA = await createFile(
        `link to [template](.foam/templates/template.md).`
      );
      // Note: template is NOT in the workspace because .foam/** is excluded from indexing
      const ws = createTestWorkspace().set(
        parser.parse(noteA.uri, noteA.content)
      );
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);

      // Position within the link: "link to [template](.foam/templates/template.md)."
      //                                      ^col 9
      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(0, 10)
      );

      expect(definitions).toBeDefined();
      expect(definitions.length).toEqual(1);
      expect(definitions[0].targetUri).toEqual(toVsCodeUri(template.uri));
    });
  });
});
