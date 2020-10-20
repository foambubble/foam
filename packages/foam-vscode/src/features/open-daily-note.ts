import { ExtensionContext, commands } from "vscode";
import { FoamFeature } from "../types";
import { openDatedNote } from "../dated-notes";

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-daily-note", openDatedNote)
    );
  }
};

export default feature;
