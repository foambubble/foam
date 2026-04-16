import {
  window,
  workspace,
  ExtensionContext,
  commands,
  ProgressLocation,
} from 'vscode';
import { Foam } from '../../core/model/foam';
import { Range } from '../../core/model/range';
import {
  toVsCodePosition,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';
import { getWikilinkDefinitionSetting } from '../../features/commands/update-wikilinks';
import {
  computeNonDirtyEdits,
  computeDirtyEdits,
  JanitorResult,
} from '../janitor';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.janitor', async () =>
      janitor(await foamPromise)
    )
  );
}

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

async function runJanitor(foam: Foam): Promise<JanitorResult> {
  const notes = foam.workspace.list().filter(r => r.uri.isMarkdown());

  const dirtyTextDocuments = workspace.textDocuments.filter(
    textDocument =>
      (textDocument.languageId === 'markdown' ||
        textDocument.languageId === 'mdx') &&
      textDocument.isDirty
  );

  const dirtyFsPaths = new Set(
    dirtyTextDocuments.map(doc => doc.uri.fsPath)
  );

  const dirtyNotes = notes.filter(note =>
    dirtyFsPaths.has(note.uri.toFsPath())
  );
  const nonDirtyNotes = notes.filter(
    note => !dirtyFsPaths.has(note.uri.toFsPath())
  );

  const wikilinkSetting = getWikilinkDefinitionSetting();

  let updatedHeadingCount = 0;
  let updatedDefinitionListCount = 0;

  // Apply text edits to non-dirty notes via the file system
  const nonDirtyEdits = await computeNonDirtyEdits(
    nonDirtyNotes,
    foam.workspace,
    wikilinkSetting
  );

  await Promise.all(
    nonDirtyEdits.map(({ uri, updatedText }) =>
      workspace.fs.writeFile(toVsCodeUri(uri), Buffer.from(updatedText))
    )
  );

  for (const { addedHeading, addedDefinitions } of nonDirtyEdits) {
    if (addedHeading) updatedHeadingCount += 1;
    if (addedDefinitions) updatedDefinitionListCount += 1;
  }

  // Handle dirty editors in serial — VS Code only allows edits on active editors
  for (const doc of dirtyTextDocuments) {
    const editor = await window.showTextDocument(doc);
    const note = dirtyNotes.find(
      n => n.uri.toFsPath() === editor.document.uri.fsPath
    )!;

    const noteText = doc.getText();
    const eol = doc.eol.toString();

    const { heading, definitions } = computeDirtyEdits(
      note,
      noteText,
      eol,
      foam.workspace,
      wikilinkSetting
    );

    if (heading || definitions.length > 0) {
      await editor.edit(editBuilder => {
        // Note: ordering matters — definitions before heading
        if (definitions.length > 0) {
          updatedDefinitionListCount += 1;
          definitions.forEach(definition => {
            const range = Range.createFromPosition(
              definition.range.start,
              definition.range.end
            );
            editBuilder.replace(toVsCodeRange(range), definition.newText);
          });
        }

        if (heading) {
          updatedHeadingCount += 1;
          editBuilder.replace(
            toVsCodePosition(heading.range.start),
            heading.newText
          );
        }
      });
    }
  }

  return {
    updatedHeadingCount,
    updatedDefinitionListCount,
    changedAnyFiles: updatedHeadingCount + updatedDefinitionListCount,
  };
}
