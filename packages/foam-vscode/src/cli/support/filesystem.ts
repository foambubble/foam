import fs from 'node:fs/promises';
import path from 'node:path';

import { URI } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import {
  AttachmentResourceProvider,
  defaultAttachmentExtensions,
} from '@foam/core';
import { IDataStore } from '@foam/core';
import { createMarkdownParser } from '@foam/core';
import { MarkdownResourceProvider } from '@foam/core';

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
    private readonly excludedPaths: string[]
  ) {}

  async list() {
    const files: string[] = [];
    await collectFiles(this.rootDir, files, this.excludedPaths);
    return files.map(file => URI.file(file));
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
  const dataStore = new NodeFileDataStore(rootDir, [
    ...new Set(
      (options.excludedPaths ?? []).map(excludedPath =>
        path.resolve(excludedPath)
      )
    ),
  ]);
  const parser = createMarkdownParser();
  const providers = [
    new MarkdownResourceProvider(dataStore, parser, options.noteExtensions),
    new AttachmentResourceProvider(defaultAttachmentExtensions),
  ];
  const workspace = await FoamWorkspace.fromProviders(
    [rootUri],
    providers,
    dataStore
  );

  return {
    rootDir,
    rootUri,
    workspace,
  };
}
