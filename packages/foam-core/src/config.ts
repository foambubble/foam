import { readFileSync } from 'fs';
import { merge } from 'lodash';

export interface FoamConfig {
  workspaceFolders: string[];
  get<T>(path: string): T | undefined;
  get<T>(path: string, defaultValue: T): T;
}

export const createConfigFromObject = (
  workspaceFolders: string[],
  settings: any
) => {
  const config: FoamConfig = {
    workspaceFolders: workspaceFolders,
    get: <T>(path: string, defaultValue?: T) => {
      const tokens = path.split('.');
      const value = tokens.reduce((acc, t) => acc?.[t], settings);
      return value ?? defaultValue;
    },
  };
  return config;
};

export const createConfigFromFolders = (
  workspaceFolders: string[] | string
): FoamConfig => {
  if (!Array.isArray(workspaceFolders)) {
    workspaceFolders = [workspaceFolders];
  }
  const workspaceConfig: any = workspaceFolders.reduce(
    (acc, f) => merge(acc, parseConfig(`${f}/config.json`)),
    {}
  );
  // For security reasons local plugins can only be
  // activated via user config
  if ('experimental' in workspaceConfig) {
    delete workspaceConfig['experimental']['localPlugins'];
  }

  const userConfig = parseConfig(`~/.foam/config.json`);

  const settings = merge(workspaceConfig, userConfig);

  return createConfigFromObject(workspaceFolders, settings);
};

const parseConfig = (path: string) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.warn('Could not read configuration from ' + path);
  }
};
