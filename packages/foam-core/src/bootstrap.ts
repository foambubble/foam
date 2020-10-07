import glob from 'glob';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import detectNewline from 'detect-newline';
import { createGraph, NoteGraphAPI } from './note-graph';
import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam } from './index';
import { loadPlugins } from './plugins';
import { isNotNull } from './utils';
import { NoteParser } from './types';

const findAllFiles = promisify(glob);

const loadNoteGraph = (
  graph: NoteGraphAPI,
  parser: NoteParser,
  files: string[]
) => {
  return Promise.all(
    files.map(f => {
      return fs.promises.readFile(f).then(data => {
        const markdown = (data || '').toString();
        const eol = detectNewline(markdown) || os.EOL;
        graph.setNote(parser.parse(f, markdown, eol));
      });
    })
  ).then(() => graph);
};

export const bootstrap = async (config: FoamConfig) => {
  const plugins = await loadPlugins(config);
  const middlewares = plugins
    .map(p => p.graphMiddleware || null)
    .filter(isNotNull);
  const parserPlugins = plugins.map(p => p.parser || null).filter(isNotNull);

  const parser = createMarkdownParser(parserPlugins);
  const files = await Promise.all(
    config.workspaceFolders.map(folder => {
      if (folder.substr(-1) === '/') {
        folder = folder.slice(0, -1);
      }
      return findAllFiles(`${folder}/**/*.md`, {});
    })
  );

  const graph = await loadNoteGraph(
    createGraph(middlewares),
    parser,
    ([] as string[]).concat(...files)
  );

  return {
    notes: graph,
    config: config,
    parse: parser.parse,
  } as Foam;
};
