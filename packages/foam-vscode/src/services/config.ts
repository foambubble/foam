import { workspace } from "vscode";
import { FoamConfig, createConfigFromFolders } from "foam-core";
import { getIgnoredFilesSetting } from "../settings";

// TODO this is still to be improved - foam config should
// not be dependent on vscode but at the moment it's convenient
// to leverage it
export const getConfigFromVscode = (): FoamConfig => {
  const workspaceFolders = workspace.workspaceFolders.map(
    dir => dir.uri.fsPath
  );
  const excludeGlobs: string[] = getIgnoredFilesSetting();

  return createConfigFromFolders(workspaceFolders, {
    ignore: excludeGlobs
  });
};
