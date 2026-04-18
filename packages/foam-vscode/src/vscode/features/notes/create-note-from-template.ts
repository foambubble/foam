import { commands, ExtensionContext } from 'vscode';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.create-note-from-template',
      async () => {
        await commands.executeCommand('foam-vscode.create-note', {
          askForTemplate: true,
        });
      }
    )
  );
}
