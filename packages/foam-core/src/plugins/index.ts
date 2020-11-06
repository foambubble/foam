import * as fs from 'fs';
import path from 'path';
import { Node } from 'unist';
import { isNotNull } from '../utils';
import { Middleware } from '../note-graph';
import { Note } from '../types';
import unified from 'unified';
import { FoamConfig } from '../config';

export interface FoamPlugin {
  name: string;
  description?: string;
  graphMiddleware?: Middleware;
  parser?: ParserPlugin;
}

export interface ParserPlugin {
  visit?: (node: Node, note: Note) => void;
  onDidInitializeParser?: (parser: unified.Processor) => void;
  onWillParseMarkdown?: (markdown: string) => string;
  onWillVisitTree?: (tree: Node, note: Note) => void;
  onDidVisitTree?: (tree: Node, note: Note) => void;
  onDidFindProperties?: (properties: any, note: Note) => void;
}

export interface PluginConfig {
  enabled?: boolean;
  pluginFolders?: string[];
}

export const SETTINGS_PATH = 'experimental.localPlugins';

export async function loadPlugins(config: FoamConfig): Promise<FoamPlugin[]> {
  const pluginConfig = config.get<PluginConfig>(SETTINGS_PATH, {});
  const isFeatureEnabled = pluginConfig.enabled ?? false;
  if (!isFeatureEnabled) {
    return [];
  }
  const pluginDirs: string[] =
    pluginConfig.pluginFolders ?? findPluginDirs(config.workspaceFolders);

  const plugins = await Promise.all(
    pluginDirs
      .filter(dir => fs.statSync(dir).isDirectory)
      .map(async dir => {
        try {
          const pluginFile = path.join(dir, 'index.js');
          fs.accessSync(pluginFile);
          const plugin = validate(await import(pluginFile));
          return plugin;
        } catch (e) {
          console.error(`Error while loading plugin at [${dir}] - skipping`, e);
          return null;
        }
      })
  );
  return plugins.filter(isNotNull);
}

function findPluginDirs(workspaceFolders: string[]) {
  return workspaceFolders
    .map(root => path.join(root, '.foam', 'plugins'))
    .reduce((acc, pluginDir) => {
      try {
        const content = fs
          .readdirSync(pluginDir)
          .map(dir => path.join(pluginDir, dir));
        return [...acc, ...content.filter(c => fs.statSync(c).isDirectory())];
      } catch {
        return acc;
      }
    }, [] as string[]);
}

function validate(plugin: any): FoamPlugin {
  if (!plugin.name) {
    throw new Error('Plugin must export `name` string property');
  }
  return plugin;
}
