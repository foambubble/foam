import { window, workspace } from 'vscode';
import { findSelectionContent, getCurrentEditorDirectory } from './editor';
import { UserCancelledOperation } from './errors';
import { VariableProvider } from '../../core/templates/variable-resolver';

export type { VariableProvider };

/**
 * VS Code implementation of VariableProvider.
 * Resolves FOAM_TITLE via an input box, FOAM_SELECTED_TEXT from the active
 * editor selection, and FOAM_CURRENT_DIR from the active editor's directory.
 */
export class VsCodeVariableProvider implements VariableProvider {
  async resolveTitle(): Promise<string> {
    const title = await window.showInputBox({
      prompt: `Enter a title for the new note`,
      value: 'Title of my New Note',
      validateInput: value =>
        value.trim().length === 0 ? 'Please enter a title' : undefined,
    });
    if (title === undefined) {
      throw new UserCancelledOperation('User did not provide a note title');
    }
    return title;
  }

  resolveSelectedText(): string {
    return findSelectionContent()?.content ?? '';
  }

  resolveCurrentDir(): string {
    try {
      return getCurrentEditorDirectory().path;
    } catch {
      if (workspace.workspaceFolders?.length > 0) {
        return workspace.workspaceFolders[0].uri.path;
      }
      throw new Error('No workspace is open');
    }
  }
}
