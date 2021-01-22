import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Foam } from 'foam-core';
import { getOrphansConfig, OrphansConfig } from '../settings';
import { focusNote } from '../utils';
import { FoamFeature } from '../types';

const ORPHANS_FILENAME = 'orphans';
const ORPHANS_EXTENSION = '.md';
const ORPHANS_TITLE = 'Orphans';

// TODO: path option?
// TODO: other than markdown for dialog?

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const config = getOrphansConfig();
    const orphansReportPath = path.join(
      root,
      `${ORPHANS_FILENAME}${ORPHANS_EXTENSION}`
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('foam-vscode.orphans', async () => {
        const orphansPaths = getOrphansPaths(foam, root, config);
        const report = getOrphansReport(orphansPaths, config);

        await fs.promises.writeFile(orphansReportPath, report);
        await focusNote(orphansReportPath, false);
      })
    );
  },
};

function getOrphansReport(paths: string[], config: OrphansConfig) {
  const content = getOrphansReportContent(paths, config);
  return `# ${ORPHANS_TITLE}\n\n${content}`;
}

function getOrphansReportContent(
  paths: string[],
  config: OrphansConfig
): string {
  if (config.groupBy === 'folder') {
    return getOrphansByDirectoryReport(paths);
  }

  return paths
    .map(p => path.parse(p).name)
    .sort((a, b) => a.localeCompare(b))
    .map(name => `- [[${name}]]`)
    .join('\n');
}

function getOrphansPaths(
  foam: Foam,
  root: string,
  config: OrphansConfig
): string[] {
  const excludePaths = config.exclude.map(d => path.normalize(`/${d}`));

  return foam.notes
    .getNotes()
    .filter(note => {
      const forwardLinks = foam.notes.getForwardLinks(note.uri);
      const backlinks = foam.notes
        .getBacklinks(note.uri)
        .map(b => path.parse(b.from.path).name);
      // If the note is linked to by `orphans`, we want to conserve it
      if (backlinks.includes(ORPHANS_FILENAME)) {
        return true;
      }
      return !forwardLinks.length && !backlinks.length;
    })
    .map(note => note.uri.path.replace(root, ''))
    .filter(p => {
      const { dir, name } = path.parse(p);
      return !excludePaths.includes(dir) && name !== ORPHANS_FILENAME;
    });
}

function getOrphansByDirectoryReport(paths: string[]): string {
  const grouped: { [key: string]: string[] } = {};
  for (const p of paths) {
    const { dir, name } = path.parse(p);
    if (grouped[dir]) {
      grouped[dir].push(name);
    } else {
      grouped[dir] = [name];
    }
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([directory, names]) => {
      const sortedNames = names
        .sort((a, b) => a.localeCompare(b))
        .map(name => `- [[${name}]]`)
        .join('\n');
      return `## \`${directory}\`\n\n${sortedNames}`;
    })
    .join('\n\n');
}

export default feature;
