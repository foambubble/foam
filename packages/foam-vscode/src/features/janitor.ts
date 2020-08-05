import {
  window,
  workspace,
  ExtensionContext,
  commands,
  Range,
  ProgressLocation
} from "vscode";
import fs = require("fs");
import { FoamFeature } from "../types";
import {
  applyTextEdit,
  generateLinkReferences,
  generateHeading,
  Foam
} from "foam-core";

import { includeExtensions } from "../settings";
import { astPositionToVsCodePosition } from "../utils";

const feature: FoamFeature = {
  activate: async (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.janitor", async () =>
        janitor(await foamPromise)
      )
    );
  }
};

async function janitor(foam: Foam) {
  try {
    const noOfFiles = foam.notes.getNotes().filter(Boolean).length;

    if (noOfFiles === 0) {
      return window.showInformationMessage(
        "Foam Janitor didn't find any notes to clean up."
      );
    }

    const outcome = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Running Foam Janitor across ${noOfFiles} files!`
      },
      () => runJanitor(foam)
    );

    if (!outcome.changedAnyFiles) {
      window.showInformationMessage(
        `Foam Janitor checked ${noOfFiles} files, and found nothing to clean up!`
      );
    } else {
      window.showInformationMessage(
        `Foam Janitor checked ${noOfFiles} files and updated ${outcome.updatedDefinitionListCount} out-of-date definition lists and added ${outcome.updatedHeadingCount} missing headings. Please check the changes before committing them into version control!`
      );
    }
  } catch (e) {
    window.showErrorMessage(`Foam Janitor attempted to clean your workspace but ran into an error. Please check that we didn't break anything before committing any changes to version control, and pass the following error message to the Foam team on GitHub issues:
    ${e.message}
    ${e.stackTrace}`);
  }
}

async function runJanitor(foam: Foam) {
  const notes = foam.notes.getNotes().filter(Boolean);

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

  const dirtyNotes = notes.filter(note =>
    dirtyEditorsFileName.includes(note.source.uri)
  );

  const nonDirtyNotes = notes.filter(
    note => !dirtyEditorsFileName.includes(note.source.uri)
  );

  // Apply Text Edits to Non Dirty Notes using fs module just like CLI

  const fileWritePromises = nonDirtyNotes.map(note => {
    let heading = generateHeading(note);
    if (heading) {
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
    let text = note.source.text;
    text = definitions ? applyTextEdit(text, definitions) : text;
    text = heading ? applyTextEdit(text, heading) : text;

    return fs.promises.writeFile(note.source.uri, text);
  });

  await Promise.all(fileWritePromises);

  // Handle dirty editors in serial, as VSCode only allows
  // edits to be applied to active text editors
  for (const doc of dirtyTextDocuments) {
    const editor = await window.showTextDocument(doc);
    const note = dirtyNotes.find(
      n => n.source.uri === editor.document.fileName
    );

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
          const start = astPositionToVsCodePosition(definitions.range.start);
          const end = astPositionToVsCodePosition(definitions.range.end);

          const range = new Range(start, end);
          editBuilder.replace(range, definitions!.newText);
        }

        if (heading) {
          updatedHeadingCount += 1;
          const start = astPositionToVsCodePosition(heading.range.start);
          editBuilder.replace(start, heading.newText);
        }
      });
    }
  }

  return {
    updatedHeadingCount,
    updatedDefinitionListCount,
    changedAnyFiles: updatedHeadingCount + updatedDefinitionListCount
  };
}

export default feature;
