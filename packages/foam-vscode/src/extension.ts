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

let workspaceWatcher: FileSystemWatcher | null = null;

export function activate(context: ExtensionContext) {
  const foamPromise = bootstrap();
  features.forEach(f => {
    f.activate(context, foamPromise);
  });
}

export function deactivate() {
  workspaceWatcher?.dispose();
}

function isLocalMarkdownFile(uri: Uri) {
  return uri.scheme === "file" && uri.path.match(/\.(md|mdx|markdown)/i);
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

const bootstrap = async () => {
  const files = await workspace.findFiles("**/*");
  const config: FoamConfig = getConfig();
  const foam = await foamBootstrap(config);
  const addFile = (uri: Uri) => registerFile(foam, uri);

  await Promise.all(files.filter(isLocalMarkdownFile).map(addFile));

  workspaceWatcher = workspace.createFileSystemWatcher(
    "**/*",
    false,
    true,
    true
  );

  workspaceWatcher.onDidCreate(uri => {
    if (isLocalMarkdownFile(uri)) {
      addFile(uri).then(() => {
        console.log(`Added ${uri} to workspace`);
      });
    }
  });

  return foam;
};

export const getConfig = (): FoamConfig => {
  const foamFolders = workspace.workspaceFolders
    .filter(dir =>
      fs.statSync(path.join(dir.uri.fsPath, ".foam")).isDirectory()
    )
    .map(dir => dir.uri.fsPath);

  return createConfigFromFolders(foamFolders);
};
