import { window, env, ExtensionContext, commands } from 'vscode';
import { removeBrackets } from '../../utils';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.copy-without-brackets',
      copyWithoutBrackets
    )
  );
}

async function copyWithoutBrackets() {
  // Get the active text editor
  const editor = window.activeTextEditor;

  if (editor) {
    const document = editor.document;
    const selection = editor.selection;

    // Get the words within the selection
    const text = document.getText(selection);

    // Remove brackets from text
    const modifiedText = removeBrackets(text);

    // Copy to the clipboard
    await env.clipboard.writeText(modifiedText);

    // Alert the user it was successful
    window.showInformationMessage('Successfully copied to clipboard!');
  }
}
