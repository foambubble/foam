import { Disposable, workspace } from 'vscode';

export interface ConfigurationMonitor<T> extends Disposable {
  (): T;
}

export const getFoamVsCodeConfig = <T>(key: string, defaultValue?: T): T =>
  workspace.getConfiguration('foam').get(key, defaultValue);

export const updateFoamVsCodeConfig = <T>(key: string, value: T) =>
  workspace.getConfiguration().update('foam.' + key, value);

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
