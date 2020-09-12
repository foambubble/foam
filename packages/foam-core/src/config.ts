import fs from 'fs';
import path from 'path';
import { FoamConfig } from 'index';

export const createConfigFromFolders = (foamFolders: string[]): FoamConfig => {
  return {
    pluginPaths: foamFolders
      .map(root => path.join(root, '.foam', 'plugins'))
      .reduce((acc, pluginDir) => {
        try {
          const content = fs.readdirSync(pluginDir);
          return [...acc, ...content.filter(c => fs.statSync(c).isDirectory())];
        } catch {
          return acc;
        }
      }, [] as string[]),
    foamFolders: foamFolders,
  };
};
