import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { Foam } from '../core/model/foam';
import { linkCommitCharacters } from './link-completion';

export const COMPLETION_CURSOR_MOVE = {
  command: 'foam-vscode.completion-move-cursor',
  title: 'Foam: Move cursor after completion',
};

const completionCursorMove: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        COMPLETION_CURSOR_MOVE.command,
        async () => {
          const activeEditor = vscode.window.activeTextEditor;
          const document = activeEditor.document;
          const currentPosition = activeEditor.selection.active;
          const cursorChange = vscode.window.onDidChangeTextEditorSelection(
            async e => {
              const changedPosition = e.selections[0].active;
              const preChar = document
                .lineAt(changedPosition.line)
                .text.charAt(changedPosition.character - 1);

              const {
                character: selectionChar,
                line: selectionLine,
              } = e.selections[0].active;

              const {
                line: completionLine,
                character: completionChar,
              } = currentPosition;

              const inCompleteBySectionDivider =
                linkCommitCharacters.includes(preChar) &&
                selectionLine === completionLine &&
                selectionChar === completionChar + 1;

              cursorChange.dispose();
              if (inCompleteBySectionDivider) {
                await vscode.commands.executeCommand('cursorMove', {
                  to: 'left',
                  by: 'character',
                  value: 2,
                });
              }
            }
          );

          await vscode.commands.executeCommand('cursorMove', {
            to: 'right',
            by: 'character',
            value: 2,
          });
        }
      )
    );
  },
};

export default completionCursorMove;
