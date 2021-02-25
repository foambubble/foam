import * as vscode from 'vscode';
import * as fs from 'fs';
import { dirname, join } from 'path';
import { FoamFeature } from '../types';
import { commands } from 'vscode';

export const OPEN_PLACEHOLDER_NOTE_COMMAND = {
  command: 'foam-vscode.open-placeholder-note',
  title: 'Foam: Open Placeholder Note',
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        OPEN_PLACEHOLDER_NOTE_COMMAND.command,
        async (uri: vscode.Uri) => {
          let dir: string;

          if (vscode.workspace.workspaceFolders) {
            dir = vscode.workspace.workspaceFolders[0].uri.fsPath.toString();
          }

          if (!dir) {
            const activeFile = vscode.window.activeTextEditor?.document;
            dir = activeFile ? dirname(activeFile.uri.fsPath) : null;
          }

          if (dir) {
            const path = join(dir, `${uri.path}.md`);
            await fs.promises.writeFile(path, `# ${uri.path}`);
            const ur = vscode.Uri.file(path);
            await vscode.window.showTextDocument(ur, {
              preserveFocus: false,
              preview: false,
            });
          }
        }
      )
    );
  },
};

export default feature;
