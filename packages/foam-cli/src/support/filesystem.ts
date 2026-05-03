import fs from 'node:fs/promises';
import path from 'node:path';

import {
  URI,
  AttachmentResourceProvider,
  defaultAttachmentExtensions,
  IDataStore,
  createMarkdownParser,
  MarkdownResourceProvider,
  bootstrap,
  AlwaysIncludeMatcher,
} from '@foam/core';

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
  // TODO: MAJOR GAP — The CLI has no concept of Foam workspace configuration.
  // All Foam settings live in VS Code's settings.json under the `foam.*` namespace,
  // and the CLI cannot read them. This affects correctness across every command:
  //
  //   • foam.files.include / foam.files.exclude — the CLI uses AlwaysIncludeMatcher,
  //     which includes every file under the workspace root (minus hardcoded dir names
  //     like .git and node_modules). VS Code builds a FileListBasedMatcher from the
  //     user's globs. A workspace with draft/ or archive/ excluded in VS Code will
  //     have those files silently indexed here.
  //   • foam.openDailyNote.directory / filenameFormat — `foam daily` won't know the
  //     correct path without reading this config.
  //   • foam.files.defaultNoteExtension — note creation may use the wrong extension.
  //   • foam.templates.directory — template lookup will look in the wrong place.
  //   • foam.links.wikilinkPathStrategy — identifier resolution may differ from VS Code.
  //
  // Until a configuration layer is added, the CLI workspace view will diverge from
  // what the user sees in VS Code. See the Known Issues section in foam-cli-spec.md
  // for the proposed fix (reading .vscode/settings.json with a .foam/config.json
  // override).
  const matcher = new AlwaysIncludeMatcher();
  const foam = await bootstrap(
    [rootUri],
    matcher,
    undefined,
    dataStore,
    parser,
    providers,
    '.md',
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
