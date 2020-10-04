import * as fs from 'fs';
import path from 'path';
import { Node } from 'unist';
import { isNotNull } from '../utils';
import { Middleware } from '../note-graph';
import { Note } from '../types';
import unified from 'unified';

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
}

export async function loadPlugins(pluginDirs: string[]): Promise<FoamPlugin[]> {
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

function validate(plugin: any): FoamPlugin {
  if (!plugin.name) {
    throw new Error('Plugin must export `name` string property');
  }
  return plugin;
}
