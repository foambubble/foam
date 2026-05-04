import fs from 'node:fs/promises';
import path from 'node:path';
import micromatch from 'micromatch';

import {
  URI,
  AttachmentResourceProvider,
  defaultAttachmentExtensions,
  IDataStore,
  createMarkdownParser,
  MarkdownResourceProvider,
  bootstrap,
  AlwaysIncludeMatcher,
  Config,
} from '@foam/core';
import { readFoamConfig } from './config';

const DEFAULT_EXCLUDED_DIR_NAMES = new Set([
  '.astro',
  '.git',
  'node_modules',
  '.yarn',
]);

const isWithinPath = (candidate: string, parent: string) => {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
};

class NodeFileDataStore implements IDataStore {
  constructor(
    private readonly rootDir: string,
    private readonly excludedPaths: string[],
    private readonly includeGlobs: string[] = ['**/*'],
    private readonly excludeGlobs: string[] = []
  ) {}

  async list() {
    const files: string[] = [];
    await collectFiles(this.rootDir, files, this.excludedPaths);
    const uris = files.map(file => URI.file(file));
    if (
      this.includeGlobs.length === 1 &&
      this.includeGlobs[0] === '**/*' &&
      this.excludeGlobs.length === 0
    ) {
      return uris;
    }
    return uris.filter(uri => {
      const rel = path.relative(this.rootDir, uri.toFsPath());
      const included = micromatch.isMatch(rel, this.includeGlobs);
      const excluded =
        this.excludeGlobs.length > 0 &&
        micromatch.isMatch(rel, this.excludeGlobs);
      return included && !excluded;
    });
  }

  async read(uri: URI) {
    try {
      return await fs.readFile(uri.toFsPath(), 'utf8');
    } catch {
      return null;
    }
  }
}

async function collectFiles(
  dir: string,
  files: string[],
  excludedPaths: string[]
) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (
      excludedPaths.some(excludedPath => isWithinPath(fullPath, excludedPath))
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      if (DEFAULT_EXCLUDED_DIR_NAMES.has(entry.name)) {
        continue;
      }

      await collectFiles(fullPath, files, excludedPaths);
      continue;
    }

    files.push(fullPath);
  }
}

export interface LoadWorkspaceOptions {
  excludedPaths?: string[];
  noteExtensions?: string[];
}

export async function loadWorkspaceFromDirectory(
  workspaceDir: string,
  options: LoadWorkspaceOptions = {}
) {
  const rootDir = path.resolve(workspaceDir);
  const rootUri = URI.file(rootDir);

  const foamConfig = readFoamConfig(rootDir);
  Config.setDefaultConfig(foamConfig);

  const dataStore = new NodeFileDataStore(
    rootDir,
    [
      ...new Set(
        (options.excludedPaths ?? []).map(excludedPath =>
          path.resolve(excludedPath)
        )
      ),
    ],
    Config.getFilesInclude(),
    Config.getFilesExclude()
  );

  const noteExtensions = options.noteExtensions ?? Config.getNotesExtensions();
  const parser = createMarkdownParser();
  const providers = [
    new MarkdownResourceProvider(dataStore, parser, noteExtensions),
    new AttachmentResourceProvider(defaultAttachmentExtensions),
  ];

  const matcher = new AlwaysIncludeMatcher();
  const foam = await bootstrap(
    [rootUri],
    matcher,
    undefined,
    dataStore,
    parser,
    providers,
    Config.getDefaultNoteExtension(),
    'debug'
  );

  return {
    rootDir,
    rootUri,
    workspace: foam.workspace,
    foam,
    dataStore,
  };
}
