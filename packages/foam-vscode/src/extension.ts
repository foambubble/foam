/**
 * Adapted from vscode-markdown/src/toc.ts
 * https://github.com/yzhang-gh/vscode-markdown/blob/master/src/toc.ts
 */
"use strict";

import * as fs from "fs";
import { workspace, ExtensionContext } from "vscode";

import { createNoteFromMarkdown, createFoam, FoamConfig } from "foam-core";
import { features } from "./features";

export function activate(context: ExtensionContext) {
  const foamPromise = bootstrap(getConfig())
  features.forEach(f => {
    f.activate(context, foamPromise);
  })
}

const bootstrap = async (config: FoamConfig) => {
  const files = await workspace.findFiles("**/*");
  const foam = createFoam(config);
  await Promise.all(
    files
      .filter(f => f.scheme === "file" && f.path.match(/\.(md|mdx|markdown)/i))
      .map(f => {
        return fs.promises.readFile(f.fsPath).then(data => {
          const markdown = (data || "").toString();
          foam.notes.setNote(createNoteFromMarkdown(f.fsPath, markdown));
        });
      })
  );
  return foam;
};

const getConfig = () => {
  return {}
}



