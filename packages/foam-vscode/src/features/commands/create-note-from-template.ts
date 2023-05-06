import { commands, ExtensionContext } from 'vscode';
import { askUserForTemplate, NoteFactory } from '../../services/templates';
import { Resolver } from '../../services/variable-resolver';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.create-note-from-template',
      async () => {
        const templateUri = await askUserForTemplate();

        if (templateUri) {
          const resolver = new Resolver(new Map(), new Date());

          await NoteFactory.createFromTemplate(templateUri, resolver);
        }
      }
    )
  );
}
