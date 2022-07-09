import { commands, ExtensionContext } from 'vscode';
import { FoamFeature } from '../../types';
import { createTemplate } from '../../services/templates';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-new-template',
        createTemplate
      )
    );
  },
};

export default feature;
