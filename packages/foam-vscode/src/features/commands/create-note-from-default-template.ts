import { commands, ExtensionContext } from 'vscode';
import { FoamFeature } from '../../types';
import { getDefaultTemplateUri, NoteFactory } from '../../services/templates';
import { Resolver } from '../../services/variable-resolver';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-note-from-default-template',
        () => {
          const resolver = new Resolver(new Map(), new Date());

          return NoteFactory.createFromTemplate(
            getDefaultTemplateUri(),
            resolver,
            undefined,
            `---
foam_template:
  name: New Note
  description: Foam's default new note template
---
# \${FOAM_TITLE}

\${FOAM_SELECTED_TEXT}
`
          );
        }
      )
    );
  },
};

export default feature;
