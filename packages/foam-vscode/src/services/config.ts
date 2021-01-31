import { workspace } from 'vscode';
import { FoamConfig, createConfigFromFolders } from 'foam-core';
import { getIgnoredFilesSetting, getNumericTaggingEnabled } from '../settings';

// TODO this is still to be improved - foam config should
// not be dependent on vscode but at the moment it's convenient
// to leverage it
export const getConfigFromVscode = (): FoamConfig => {
  const numericTaggingEnabled = getNumericTaggingEnabled();
  const workspaceFolders = workspace.workspaceFolders.map(dir => dir.uri);
  const excludeGlobs = getIgnoredFilesSetting();

  return createConfigFromFolders(
    workspaceFolders,
    {
      ignore: excludeGlobs.map(g => g.toString()),
    },
    numericTaggingEnabled
  );
};
