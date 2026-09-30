/* @unit-ready */
import { QuickPickItem, window, workspace } from 'vscode';
import { URI } from '@foam/core';
import {
  askUserForTemplate,
  getDailyNoteTemplateUri,
  getDefaultTemplateUri,
  getTemplatesDir,
  getTemplates,
} from './template-service';
import { writeFile } from './editor';
import { toVsCodeUri } from '../utils/vsc-utils';
import {
  createFile,
  deleteFile,
  withModifiedFoamConfiguration,
  withSecondRoot,
} from '../../test/test-utils-vscode';

describe('getTemplatesDir', () => {
  it('should return the default .foam/templates directory', () => {
    const dir = getTemplatesDir();
    expect(dir.path).toContain('.foam/templates');
  });

  it('stays in the first workspace root, where new templates are created, when there are several', async () => {
    const firstRootDir = getTemplatesDir();
    await withSecondRoot(async () => {
      expect(getTemplatesDir().toFsPath()).toEqual(firstRootDir.toFsPath());
    });
  });

  it('should return the custom templates directory when foam.templates.folder is set', async () => {
    await withModifiedFoamConfiguration('templates.folder', 'custom/templates', async () => {
      const dir = getTemplatesDir();
      expect(dir.path).toContain('custom/templates');
      expect(dir.path).not.toContain('.foam/templates');
    });
  });
});

describe('getTemplates', () => {
  it('should find templates in a custom folder when foam.templates.folder is set', async () => {
    await withModifiedFoamConfiguration('templates.folder', 'custom-tpl', async () => {
      const template = await createFile('# Custom template', ['custom-tpl', 'my-template.md']);
      try {
        const templates = await getTemplates();
        const paths = templates.map(t => t.path);
        expect(paths.some(p => p.includes('custom-tpl/my-template.md'))).toBe(true);
      } finally {
        await deleteFile(template.uri);
      }
    });
  });
});

describe('default templates in a multi-root workspace', () => {
  // A templates folder no other test uses, so the first root surely has none.
  const folder = 'multi-root-templates';

  it('uses the new-note template of a later root when the first root has none (#1711)', async () => {
    await withModifiedFoamConfiguration('templates.folder', folder, () =>
      withSecondRoot(async root => {
        const template = root.joinPath(folder, 'new-note.md');
        await writeFile(template, '# Later root');
        expect((await getDefaultTemplateUri())?.toFsPath()).toEqual(
          template.toFsPath()
        );
      })
    );
  });

  it('uses the daily-note template of a later root when the first root has none (#1711)', async () => {
    await withModifiedFoamConfiguration('templates.folder', folder, () =>
      withSecondRoot(async root => {
        const template = root.joinPath(folder, 'daily-note.md');
        await writeFile(template, '# Later root');
        expect((await getDailyNoteTemplateUri())?.toFsPath()).toEqual(
          template.toFsPath()
        );
      })
    );
  });

  it("prefers the first root's new-note template over a later root's", async () => {
    await withModifiedFoamConfiguration('templates.folder', folder, () =>
      withSecondRoot(async root => {
        await writeFile(root.joinPath(folder, 'new-note.md'), '# Later root');
        const first = await createFile('# First root', [folder, 'new-note.md']);
        try {
          expect((await getDefaultTemplateUri())?.toFsPath()).toEqual(
            first.uri.toFsPath()
          );
        } finally {
          await deleteFile(first.uri);
        }
      })
    );
  });
});

describe('askUserForTemplate', () => {
  it('returns the template the user picked from another workspace root (#1711)', async () => {
    await withSecondRoot(async root => {
      const template = root.joinPath('.foam', 'templates', 'other-root.md');
      await writeFile(template, '# Other root');
      // VS Code lists the templates of every root; stand in for that listing.
      const findFiles = vi
        .spyOn(workspace, 'findFiles')
        .mockResolvedValueOnce([toVsCodeUri(template)]);
      const pick = vi
        .spyOn(window, 'showQuickPick')
        .mockImplementationOnce(
          (async (items: QuickPickItem[]) => items[0]) as any
        );
      try {
        const picked = (await askUserForTemplate()) as URI;
        expect(picked.toFsPath()).toEqual(template.toFsPath());
      } finally {
        findFiles.mockRestore();
        pick.mockRestore();
      }
    });
  });
});
