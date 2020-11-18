/**
 * Adapted from vscode-markdown/src/toc.ts
 * https://github.com/yzhang-gh/vscode-markdown/blob/master/src/toc.ts
 */
"use strict";

import path from "path";
import * as fs from "fs";
import {
  workspace,
  ExtensionContext,
  window,
  EndOfLine,
  Uri,
  FileSystemWatcher
} from "vscode";

import {
  bootstrap as foamBootstrap,
  FoamConfig,
  Foam,
  createConfigFromFolders
} from "foam-core";

import { features } from "./features";
import { getIgnoredFilesSetting } from "./settings";

let workspaceWatcher: FileSystemWatcher | null = null;

export function activate(context: ExtensionContext) {
  try {
    const foamPromise = bootstrap();
    features.forEach(f => {
      f.activate(context, foamPromise);
    });
  } catch (e) {
    console.log("An error occurred while bootstrapping Foam", e);
  }
}

export function deactivate() {
  workspaceWatcher?.dispose();
}

function isLocalMarkdownFile(uri: Uri) {
  return uri.scheme === "file" && uri.path.match(/\.(md|mdx|markdown)/i);
}

async function registerFiles(foam: Foam, localUri: Iterable<Uri>) {
  for (const uri of localUri) {
    registerFile(foam, uri);
  }
}

async function registerFile(foam: Foam, localUri: Uri) {
  // read file from disk (async)
  const path = localUri.fsPath;
  const data = await fs.promises.readFile(path);
  const markdown = (data || "").toString();

  // create note
  const eol =
    window.activeTextEditor?.document?.eol === EndOfLine.CRLF ? "\r\n" : "\n";
  const note = foam.parse(path, markdown, eol);

  // add to graph
  foam.notes.setNote(note);
  return note;
}

/**
 * Filter the files and register them in the Foam object.
 * Filtering is done according to:
 * 1. Extension (currently `.md`, `.mdx`, `.markdown`)
 * 2. Excluded globs set by the user in `foam.files.ignore`
 * @param foam the Foam object.
 * @param files the list of files to be filtered and registered.
 */
async function filterAndRegister(foam: Foam, files: Uri[]) {
  const excludedPaths: string[] = getIgnoredFilesSetting();
  const includedFiles: Map<String, Uri> = new Map();
  for (const included of files) {
    if (isLocalMarkdownFile(included)) {
      includedFiles.set(included.fsPath, included);
    }
  }
  for (const excluded of excludedPaths) {
    for (const file of await workspace.findFiles(excluded)) {
      includedFiles.delete(file.fsPath);
    }
  }
  registerFiles(foam, includedFiles.values());
}

const bootstrap = async () => {
  const config: FoamConfig = getConfig();
  const foam: Foam = await foamBootstrap(config);
  await workspace
    .findFiles("**/*")
    .then(files => filterAndRegister(foam, files));

  workspaceWatcher = workspace.createFileSystemWatcher(
    "**/*",
    false,
    true,
    true
  );

  workspaceWatcher.onDidCreate(uri => {
    if (isLocalMarkdownFile(uri)) {
      registerFile(foam, uri).then(() => {
        console.log(`Added ${uri} to workspace`);
      });
    }
  });

  return foam;
};

export const getConfig = (): FoamConfig => {
  const workspaceFolders = workspace
    .workspaceFolders!.filter(dir => {
      const foamPath = path.join(dir.uri.fsPath, ".foam");
      return fs.existsSync(foamPath) && fs.statSync(foamPath).isDirectory();
    })
    .map(dir => dir.uri.fsPath);

  return createConfigFromFolders(workspaceFolders);
};
