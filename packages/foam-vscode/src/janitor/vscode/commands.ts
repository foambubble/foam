import {
  window,
  workspace,
  ExtensionContext,
  commands,
  ProgressLocation,
} from 'vscode';
import detectNewline from 'detect-newline';
import { Foam } from '../../core/model/foam';
import { TextEdit } from '../../core/services/text-edit';
import { Range } from '../../core/model/range';
import {
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';
import { getWikilinkDefinitionSetting } from '../../features/commands/update-wikilinks';
import { lintNote } from '../janitor';

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

interface JanitorResult {
  updatedHeadingCount: number;
  updatedDefinitionListCount: number;
  changedAnyFiles: number;
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

  // Apply edits to non-dirty notes via the file system
  await Promise.all(
    nonDirtyNotes.map(async note => {
      const noteText = await foam.workspace.readAsMarkdown(note.uri);
      const eol = detectNewline(noteText) ?? '\n';
      const issues = lintNote(note, noteText, eol, foam.workspace, wikilinkSetting);
      if (issues.length === 0) return;

      if (issues.some(i => i.code === 'missing-heading')) updatedHeadingCount += 1;
      if (issues.some(i => i.code === 'stale-definitions')) updatedDefinitionListCount += 1;

      const edits = issues.flatMap(i => i.fix?.map(f => f.edit) ?? []);
      const updatedText = TextEdit.apply(noteText, edits);
      await workspace.fs.writeFile(toVsCodeUri(note.uri), Buffer.from(updatedText));
    })
  );

  // Handle dirty editors in serial — VS Code only allows edits on active editors
  for (const doc of dirtyTextDocuments) {
    const editor = await window.showTextDocument(doc);
    const note = dirtyNotes.find(
      n => n.uri.toFsPath() === editor.document.uri.fsPath
    )!;

    const noteText = doc.getText();
    const eol = doc.eol.toString();

    const issues = lintNote(note, noteText, eol, foam.workspace, wikilinkSetting);
    if (issues.length === 0) continue;

    if (issues.some(i => i.code === 'missing-heading')) updatedHeadingCount += 1;
    if (issues.some(i => i.code === 'stale-definitions')) updatedDefinitionListCount += 1;

    await editor.edit(editBuilder => {
      for (const issue of issues) {
        for (const fix of issue.fix ?? []) {
          const range = Range.createFromPosition(fix.edit.range.start, fix.edit.range.end);
          editBuilder.replace(toVsCodeRange(range), fix.edit.newText);
        }
      }
    });
  }

  return {
    updatedHeadingCount,
    updatedDefinitionListCount,
    changedAnyFiles: updatedHeadingCount + updatedDefinitionListCount,
  };
}

