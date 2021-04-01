import { Disposable, workspace } from 'vscode';
import { FoamConfig, createConfigFromFolders } from 'foam-core';
import { getIgnoredFilesSetting } from '../settings';

// TODO this is still to be improved - foam config should
// not be dependent on vscode but at the moment it's convenient
// to leverage it
export const getConfigFromVscode = (): FoamConfig => {
  const workspaceFolders = workspace.workspaceFolders.map(dir => dir.uri);
  const excludeGlobs = getIgnoredFilesSetting();

  return createConfigFromFolders(workspaceFolders, {
    ignore: excludeGlobs.map(g => g.toString()),
  });
};

export const getFoamVsCodeConfig = <T>(key: string): T =>
  workspace.getConfiguration('foam').get(key);

export const updateFoamVsCodeConfig = <T>(key: string, value: T) =>
  workspace.getConfiguration().update('foam.' + key, value);

export interface ConfigurationMonitor<T> extends Disposable {
  (): T;
}

export const monitorFoamVsCodeConfig = <T>(
  key: string
): ConfigurationMonitor<T> => {
  let value: T = getFoamVsCodeConfig(key);
  const listener = workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('foam.' + key)) {
      value = getFoamVsCodeConfig(key);
    }
  });
  const ret = () => {
    return value;
  };
  ret.dispose = () => listener.dispose();
  return ret;
};
