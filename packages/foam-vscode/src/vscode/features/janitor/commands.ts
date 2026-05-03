import {
  window,
  workspace,
  ExtensionContext,
  commands,
  ProgressLocation,
} from 'vscode';
import { Foam } from '@foam/core';
import { TextEdit } from '@foam/core';
import { Range } from '@foam/core';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';
import { getWikilinkDefinitionSetting } from '../editing/update-wikilinks';
import {
  lintWorkspace,
  missingHeadingRule,
  staleDefinitionsRule,
} from '@foam/core';

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
  const wikilinkSetting = getWikilinkDefinitionSetting();
  const rules = [
    missingHeadingRule(),
    ...(wikilinkSetting !== 'off' ? [staleDefinitionsRule(wikilinkSetting)] : []),
  ];

  const dirtyTextDocuments = workspace.textDocuments.filter(
    textDocument =>
      (textDocument.languageId === 'markdown' ||
        textDocument.languageId === 'mdx') &&
      textDocument.isDirty
  );
  const dirtyFsPaths = new Set(
    dirtyTextDocuments.map(doc => doc.uri.fsPath)
  );

  const allIssues = await lintWorkspace(foam.workspace, rules);

  let updatedHeadingCount = 0;
  let updatedDefinitionListCount = 0;

  // Apply edits to non-dirty notes via the file system
  await Promise.all(
    allIssues.entries
      .filter(({ uri }) => !dirtyFsPaths.has(uri.toFsPath()))
      .map(async ({ uri, issues }) => {
        if (issues.some(i => i.code === 'missing-heading')) updatedHeadingCount += 1;
        if (issues.some(i => i.code === 'stale-definitions')) updatedDefinitionListCount += 1;

        const noteText = await foam.workspace.readAsMarkdown(uri);
        const edits = issues.flatMap(i => i.fix?.map(f => f.edit) ?? []);
        const updatedText = TextEdit.apply(noteText, edits);
        await workspace.fs.writeFile(toVsCodeUri(uri), Buffer.from(updatedText));
      })
  );

  // Handle dirty editors in serial — VS Code only allows edits on active editors
  for (const doc of dirtyTextDocuments) {
    const editor = await window.showTextDocument(doc);
    const foamUri = fromVsCodeUri(editor.document.uri);
    const issues = allIssues.get(foamUri);
    if (!issues || issues.length === 0) continue;

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
