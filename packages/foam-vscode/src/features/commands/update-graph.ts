import { commands, ExtensionContext } from 'vscode';
import { Foam } from '../../core/model/foam';

export const UPDATE_GRAPH_COMMAND_NAME = 'foam-vscode.update-graph';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand(UPDATE_GRAPH_COMMAND_NAME, async () => {
      const foam = await foamPromise;
      return foam.graph.update();
    })
  );
}
