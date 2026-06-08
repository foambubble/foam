import { commands, ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import { getTelemetry } from '../../services/telemetry';
import { createNote } from './create-note';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.create-note-from-template',
      async () => {
        getTelemetry()?.trackCommand('foam-vscode.create-note-from-template');
        await createNote({ askForTemplate: true }, foam);
      }
    )
  );
}
