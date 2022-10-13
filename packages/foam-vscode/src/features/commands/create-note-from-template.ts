import { commands, ExtensionContext } from 'vscode';
import { FoamFeature } from '../../types';
import { askUserForTemplate, NoteFactory } from '../../services/templates';
import { Resolver } from '../../services/variable-resolver';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
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
  },
};

export default feature;
