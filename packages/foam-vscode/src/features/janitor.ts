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
import { includeExtensions } from "../settings";

const feature: FoamFeature = {
  activate: async (context: ExtensionContext, _foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.janitor", janitor)
    );
  }
};

async function janitor() {
  try {
    const outcome = await runJanitor();
    if (outcome.processedFileCount === 0) {
      window.showInformationMessage(
        "Foam Janitor didn't file any notes to clean up"
      );
    } else if (!outcome.changedAnyFiles) {
      window.showInformationMessage(
        `Foam Janitor checked ${outcome.processedFileCount} files, and found nothing to clean up!`
      );
    } else {
      window.showInformationMessage(
        `Foam Janitor checked ${outcome.processedFileCount} files and updated ${outcome.updatedDefinitionListCount} out-of-date definition lists and added ${outcome.updatedHeadingCount} missing headings. Please check the changes before committing them into version control!`
      );
    }
  } catch (e) {
    window.showErrorMessage(`Foam Janitor attempted to clean your workspace but ran into an error. Please check that we didn't break anything before committing any changes to version control, and pass the following error message to the Foam team on GitHub issues:
    ${e.message}
    ${e.stackTrace}`);
  }
}

async function runJanitor() {
  const foam = await bootstrap(getConfig());
  const notes = foam.notes.getNotes().filter(Boolean);

  let processedFileCount = 0;
  let updatedHeadingCount = 0;
  let updatedDefinitionListCount = 0;

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
    processedFileCount += 1;

    let heading = generateHeading(note);
    if (heading) {
      console.log("fs.write heading " + note.path + " " + note.title);
      updatedHeadingCount += 1;
    }

    let definitions = generateLinkReferences(
      note,
      foam.notes,
      includeExtensions()
    );
    if (definitions) {
      updatedDefinitionListCount += 1;
    }

    if (!heading && !definitions) {
      return Promise.resolve();
    }

    // Apply Edits
    // Note: The ordering matters. Definitions need to be inserted
    // before heading, since inserting a heading changes line numbers below
    let text = note.source;
    text = definitions ? applyTextEdit(text, definitions) : text;
    text = heading ? applyTextEdit(text, heading) : text;

    return fs.promises.writeFile(note.path, text);
  });

  await Promise.all(fileWritePromises);

  // Handle dirty editors in serial, as VSCode only allows
  // edits to be applied to active text editors
  for (const doc of dirtyTextDocuments) {
    processedFileCount += 1;

    const editor = await window.showTextDocument(doc);
    const note = dirtyNotes.find(n => n.path === editor.document.fileName);

    // Get edits
    const heading = generateHeading(note);
    let definitions = generateLinkReferences(
      note,
      foam.notes,
      includeExtensions()
    );

    if (heading || definitions) {
      // Apply Edits
      await editor.edit(editBuilder => {
        // Note: The ordering matters. Definitions need to be inserted
        // before heading, since inserting a heading changes line numbers below
        if (definitions) {
          updatedDefinitionListCount += 1;
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

        if (heading) {
          console.log("editor.write heading " + note.title);

          updatedHeadingCount += 1;
          const start = new Position(
            heading.range.start.line,
            heading.range.start.column
          );
          editBuilder.insert(start, heading.newText);
        }
      });
    }
  }

  return {
    updatedHeadingCount,
    updatedDefinitionListCount,
    processedFileCount,
    changedAnyFiles: updatedHeadingCount + updatedDefinitionListCount
  };
}

export default feature;
