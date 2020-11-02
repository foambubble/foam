import { ExtensionContext, commands } from "vscode";
import { FoamFeature } from "../types";
import { openDailyNoteFor } from "../dated-notes";

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-daily-note", openDailyNoteFor)
    );
  }
};

export default feature;
