import * as fs from "fs";
import { basename } from "path";
import { workspace } from "vscode";
import { WorkspaceManager, NoteGraph, createNoteFromMarkdown } from "foam-workspace-manager";

// build initial index
export const manager = new WorkspaceManager(workspace.rootPath);
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
          let markdown = (data || "").toString();
          manager.addNoteFromMarkdown(f.fsPath, markdown);
          foam.setNote(createNoteFromMarkdown(f.fsPath, markdown))
        });
      })
  );
  return foam
})();
