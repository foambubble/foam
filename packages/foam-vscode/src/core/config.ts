import { readFileSync } from 'fs';
import { merge } from 'lodash';

export interface FoamConfig {
  workspaceFolders: string[];
  includeGlobs: string[];
  ignoreGlobs: string[];
  get<T>(path: string): T | undefined;
  get<T>(path: string, defaultValue: T): T;
}

const DEFAULT_INCLUDES = ['**/*'];

const DEFAULT_IGNORES = ['**/node_modules/**'];

export const createConfigFromObject = (
  workspaceFolders: string[],
  include: string[],
  ignore: string[],
  settings: any
) => {
  const config: FoamConfig = {
    workspaceFolders: workspaceFolders,
    includeGlobs: include,
    ignoreGlobs: ignore,
    get: <T>(path: string, defaultValue?: T) => {
      const tokens = path.split('.');
      const value = tokens.reduce((acc, t) => acc?.[t], settings);
      return value ?? defaultValue;
    },
  };
  return config;
};

export const createConfigFromFolders = (
  workspaceFolders: string[] | string,
  options: {
    include?: string[];
    ignore?: string[];
  } = {}
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

  return createConfigFromObject(
    workspaceFolders,
    options.include ?? DEFAULT_INCLUDES,
    options.ignore ?? DEFAULT_IGNORES,
    settings
  );
};

const parseConfig = (path: string) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.warn('Could not read configuration from ' + path);
  }
};
