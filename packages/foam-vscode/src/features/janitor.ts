import {
  window,
  workspace,
  ExtensionContext,
  commands,
  Range,
  ProgressLocation,
} from 'vscode';
import * as fs from 'fs';
import { FoamFeature } from '../types';
import {
  applyTextEdit,
  generateLinkReferences,
  generateHeading,
  Foam,
  Note,
} from 'foam-core';

import {
  getWikilinkDefinitionSetting,
  LinkReferenceDefinitionsSetting,
} from '../settings';
import { isNote } from '../utils';

const feature: FoamFeature = {
  activate: (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      commands.registerCommand('foam-vscode.janitor', async () =>
        janitor(await foamPromise)
      )
    );
  },
};

async function janitor(foam: Foam) {
  try {
    const noOfFiles = foam.workspace.list().filter(Boolean).length;

    if (noOfFiles === 0) {
      return window.showInformationMessage(
        "Foam Janitor didn't find any notes to clean up."
      );
    }

    const outcome = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Running Foam Janitor across ${noOfFiles} files!`,
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
    window.showErrorMessage(
      `Foam Janitor attempted to clean your workspace but ran into an error. Please check that we didn't break anything before committing any changes to version control, and pass the following error message to the Foam team on GitHub issues:
    ${e.message}
    ${e.stack}`
    );
  }
}

async function runJanitor(foam: Foam) {
  const notes: Note[] = foam.workspace.list().filter(isNote);

  let updatedHeadingCount = 0;
  let updatedDefinitionListCount = 0;

  const dirtyTextDocuments = workspace.textDocuments.filter(
    textDocument =>
      (textDocument.languageId === 'markdown' ||
        textDocument.languageId === 'mdx') &&
      textDocument.isDirty
  );

  const dirtyEditorsFileName = dirtyTextDocuments.map(
    dirtyTextDocument => dirtyTextDocument.uri.fsPath
  );

  const dirtyNotes = notes.filter(note =>
    dirtyEditorsFileName.includes(note.uri.fsPath)
  );

  const nonDirtyNotes = notes.filter(
    note => !dirtyEditorsFileName.includes(note.uri.fsPath)
  );

  const wikilinkSetting = getWikilinkDefinitionSetting();

  // Apply Text Edits to Non Dirty Notes using fs module just like CLI

  const fileWritePromises = nonDirtyNotes.map(note => {
    let heading = generateHeading(note);
    if (heading) {
      updatedHeadingCount += 1;
    }

    let definitions =
      wikilinkSetting === LinkReferenceDefinitionsSetting.off
        ? null
        : generateLinkReferences(
            note,
            foam.workspace,
            wikilinkSetting === LinkReferenceDefinitionsSetting.withExtensions
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

    return fs.promises.writeFile(note.uri.fsPath, text);
  });

  await Promise.all(fileWritePromises);

  // Handle dirty editors in serial, as VSCode only allows
  // edits to be applied to active text editors
  for (const doc of dirtyTextDocuments) {
    const editor = await window.showTextDocument(doc);
    const note = dirtyNotes.find(
      n => n.uri.fsPath === editor.document.uri.fsPath
    )!;

    // Get edits
    const heading = generateHeading(note);
    let definitions =
      wikilinkSetting === LinkReferenceDefinitionsSetting.off
        ? null
        : generateLinkReferences(
            note,
            foam.workspace,
            wikilinkSetting === LinkReferenceDefinitionsSetting.withExtensions
          );

    if (heading || definitions) {
      // Apply Edits
      /* eslint-disable */
      await editor.edit(editBuilder => {
        // Note: The ordering matters. Definitions need to be inserted
        // before heading, since inserting a heading changes line numbers below
        if (definitions) {
          updatedDefinitionListCount += 1;
          const start = definitions.range.start;
          const end = definitions.range.end;

          const range = new Range(start, end);
          editBuilder.replace(range, definitions!.newText);
        }

        if (heading) {
          updatedHeadingCount += 1;
          const start = heading.range.start;
          editBuilder.replace(start, heading.newText);
        }
      });
      /* eslint-enable */
    }
  }

  return {
    updatedHeadingCount,
    updatedDefinitionListCount,
    changedAnyFiles: updatedHeadingCount + updatedDefinitionListCount,
  };
}

export default feature;
