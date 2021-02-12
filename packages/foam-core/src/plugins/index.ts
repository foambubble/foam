import * as fs from 'fs';
import path from 'path';
import { Node } from 'unist';
import { isNotNull } from '../utils';
import { Note } from '../model/note';
import unified from 'unified';
import { FoamConfig } from '../config';
import { Logger } from '../utils/log';
import { URI } from '../common/uri';

export interface FoamPlugin {
  name: string;
  description?: string;
  parser?: ParserPlugin;
}

export interface ParserPlugin {
  name?: string;
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
  const pluginDirs: URI[] =
    pluginConfig.pluginFolders?.map(URI.file) ??
    findPluginDirs(config.workspaceFolders);

  const plugins = await Promise.all(
    pluginDirs
      .filter(dir => fs.statSync(dir.fsPath).isDirectory)
      .map(async dir => {
        try {
          const pluginFile = path.join(dir.fsPath, 'index.js');
          fs.accessSync(pluginFile);
          Logger.info(`Found plugin at [${pluginFile}]. Loading..`);
          const plugin = validate(await import(pluginFile));
          return plugin;
        } catch (e) {
          Logger.error(`Error while loading plugin at [${dir}] - skipping`, e);
          return null;
        }
      })
  );
  return plugins.filter(isNotNull);
}

function findPluginDirs(workspaceFolders: URI[]) {
  return workspaceFolders
    .map(root => URI.joinPath(root, '.foam', 'plugins'))
    .reduce((acc, pluginDir) => {
      try {
        const content = fs
          .readdirSync(pluginDir.fsPath)
          .map(dir => URI.joinPath(pluginDir, dir));
        return [
          ...acc,
          ...content.filter(c => fs.statSync(c.fsPath).isDirectory()),
        ];
      } catch {
        return acc;
      }
    }, [] as URI[]);
}

function validate(plugin: any): FoamPlugin {
  if (!plugin.name) {
    throw new Error('Plugin must export `name` string property');
  }
  return plugin;
}
