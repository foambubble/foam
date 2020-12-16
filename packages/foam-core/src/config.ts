import { readFileSync } from 'fs';
import { merge } from 'lodash';
import { Logger } from './utils/log';
import { URI } from './common/uri';

export interface FoamConfig {
  workspaceFolders: URI[];
  includeGlobs: string[];
  ignoreGlobs: string[];
  get<T>(path: string): T | undefined;
  get<T>(path: string, defaultValue: T): T;
}

const DEFAULT_INCLUDES = ['**/*'];

const DEFAULT_IGNORES = ['**/node_modules/**'];

export const createConfigFromObject = (
  workspaceFolders: URI[],
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
  workspaceFolders: URI[] | URI,
  options: {
    include?: string[];
    ignore?: string[];
  } = {}
): FoamConfig => {
  if (!Array.isArray(workspaceFolders)) {
    workspaceFolders = [workspaceFolders];
  }
  const workspaceConfig: any = workspaceFolders.reduce(
    (acc, f) => merge(acc, parseConfig(URI.joinPath(f, 'config.json'))),
    {}
  );
  // For security reasons local plugins can only be
  // activated via user config
  if ('experimental' in workspaceConfig) {
    delete workspaceConfig['experimental']['localPlugins'];
  }

  const userConfig = parseConfig(URI.file(`~/.foam/config.json`));

  const settings = merge(workspaceConfig, userConfig);

  return createConfigFromObject(
    workspaceFolders,
    options.include ?? DEFAULT_INCLUDES,
    options.ignore ?? DEFAULT_IGNORES,
    settings
  );
};

const parseConfig = (path: URI) => {
  try {
    return JSON.parse(readFileSync(path.fsPath, 'utf8'));
  } catch {
    Logger.debug('Could not read configuration from ' + path);
  }
};
