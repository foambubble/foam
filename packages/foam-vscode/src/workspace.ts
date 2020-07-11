import * as fs from "fs";
import { basename } from "path";
import { workspace } from "vscode";
import { NoteGraph, createNoteFromMarkdown } from "@foam/core";

// build initial index
export const ready = (async () => {
  const files = await workspace.findFiles("**/*");
  const foam = new NoteGraph()
  await Promise.all(
    files
      .filter(
        (f) => f.scheme === "file" && f.path.match(/\.(md|mdx|markdown)/i)
      )
      .map((f) => {
        return fs.promises.readFile(f.fsPath).then((data) => {
          const markdown = (data || "").toString();
          foam.setNote(createNoteFromMarkdown(f.fsPath, markdown))
        });
      })
  );
  return foam
})();
