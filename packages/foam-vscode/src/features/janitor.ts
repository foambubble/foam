import {
  window,
  workspace,
  ExtensionContext,
  commands,
  Position,
  Range
} from "vscode";
import fs = require("fs");
import { FoamFeature } from "../types";
import {
  applyTextEdit,
  generateLinkReferences,
  generateHeading,
  Foam,
  Note
} from "foam-core";

import { bootstrap, getConfig } from "../extension";

const feature: FoamFeature = {
  activate: async (context: ExtensionContext, _foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.janitor", janitor)
    );
  }
};

async function janitor() {
  const foam = await bootstrap(getConfig());
  const notes = foam.notes.getNotes().filter(Boolean);

  const dirtyTextDocuments = workspace.textDocuments.filter(
    textDocument =>
      (textDocument.languageId === "markdown" ||
        textDocument.languageId === "mdx") &&
      textDocument.isDirty
  );

  const dirtyEditorsFileName = dirtyTextDocuments.map(
    dirtyTextDocument => dirtyTextDocument.fileName
  );

  const dirtyNotes: Note[] = notes.filter(note =>
    dirtyEditorsFileName.includes(note.path)
  );

  const nonDirtyNotes: Note[] = notes.filter(
    note => !dirtyEditorsFileName.includes(note.path)
  );

  // Apply Text Edits to Non Dirty Notes using fs module just like CLI

  const fileWritePromises = nonDirtyNotes.map(note => {
    // get edits
    const heading = generateHeading(note);
    let definitions = generateLinkReferences(note, foam.notes);

    // apply Edits
    let text = note.source;
    text = heading ? applyTextEdit(text, heading) : text;
    text = definitions ? applyTextEdit(text, definitions) : text;

    return fs.promises.writeFile(note.path, text);
  });

  await Promise.all(fileWritePromises);

  // Handle dirty editors in serial, as VSCode only allows
  // edits to be applied to active text editors 
  for (const doc of dirtyTextDocuments) {
    const editor = await window.showTextDocument(doc);
    const note = dirtyNotes.find(n => n.path === editor.document.fileName);

    // Get edits
    const heading = generateHeading(note);
    let definitions = generateLinkReferences(note, foam.notes);

    // Apply Edits
    await editor.edit(editBuilder => {
      if (heading) {
        const start = new Position(
          heading.range.start.line,
          heading.range.start.column
        );
        editBuilder.insert(start, heading.newText);
      }

      if (definitions) {
        const start = new Position(
          definitions.range.start.line - 1,
          definitions.range.start.column
        );
        const end = new Position(
          definitions.range.end.line - 1,
          definitions.range.end.column
        );
        const range = new Range(start, end);
        editBuilder.replace(range, definitions!.newText);
      }
    });
  }
}

export default feature;
