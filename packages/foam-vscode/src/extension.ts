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
 * Tests if a file is not ignored
 * @param root the workspace root folder
 * @param ignoredPaths the list of ignored paths
 * @param file the file to be tested
 */
function isNotIgnored(root: string, ignoredPaths: string[], file: string) {
  if (!ignoredPaths) {
    return true;
  }
  const path = file.substring(root.length); // maybe discard the /
  let notIgnored = true;
  for (const ignored of ignoredPaths) {
    notIgnored = notIgnored && !path.startsWith(ignored);
    if (!notIgnored) {
      // short circuit the loop
      return false;
    }
  }
  return true;
}

function filterIgnoredFiles(files: Uri[]) : Uri[] {
  if (!workspace.workspaceFolders) {
    return files;
  }

  const root = workspace.workspaceFolders[0].uri.path;
  if (!root) {
    return files;
  }

  const excludedPaths = getIgnoredFilesSetting();
  if (!excludedPaths) {
    return files;
  }

  const res = files.filter(v => {
    return isNotIgnored(root, excludedPaths, v.path);
  });
  return res;
}

const bootstrap = async () => {
  const files = await workspace.findFiles("**/*").then(filterIgnoredFiles);
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
  const workspaceFolders = workspace
    .workspaceFolders!.filter(dir => {
      const foamPath = path.join(dir.uri.fsPath, ".foam");
      return fs.existsSync(foamPath) && fs.statSync(foamPath).isDirectory();
    })
    .map(dir => dir.uri.fsPath);

  return createConfigFromFolders(workspaceFolders);
};
