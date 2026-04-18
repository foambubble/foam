import { commands, ExtensionContext } from 'vscode';
import { getTelemetry } from '../../services/telemetry';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.create-note-from-template',
      async () => {
        getTelemetry()?.trackCommand('foam-vscode.create-note-from-template');
        await commands.executeCommand('foam-vscode.create-note', {
          askForTemplate: true,
        });
      }
    )
  );
}
