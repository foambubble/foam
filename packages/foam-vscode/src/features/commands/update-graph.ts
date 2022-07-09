import { commands, ExtensionContext } from 'vscode';
import { FoamFeature } from '../../types';

export const UPDATE_GRAPH_COMMAND_NAME = 'foam-vscode.update-graph';

const feature: FoamFeature = {
  activate: (context: ExtensionContext, foamPromise) => {
    context.subscriptions.push(
      commands.registerCommand(UPDATE_GRAPH_COMMAND_NAME, async () => {
        const foam = await foamPromise;
        return foam.graph.update();
      })
    );
  },
};

export default feature;
