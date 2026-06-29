import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { Foam, URI, toSlug } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { getTelemetry } from '../../services/telemetry';
import { collectNoteSet } from './note-set';
import { renderReport } from './render-report';
import { slugForUri } from './slug';

export const EXPORT_HTML_PAGE_COMMAND = 'foam-vscode.export-html-page';
const DEPRECATED_PUBLISH_HTML_PAGE_COMMAND = 'foam-vscode.publish-html-page';
const DEFAULT_DEPTH = 2;

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const handler = async (commandId: string) => {
    getTelemetry()?.trackCommand(commandId);
    const foam = await foamPromise;
    try {
      await runExportHtmlPage(foam);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Foam: failed to export HTML page — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      EXPORT_HTML_PAGE_COMMAND,
      () => handler(EXPORT_HTML_PAGE_COMMAND)
    ),
    vscode.commands.registerCommand(
      DEPRECATED_PUBLISH_HTML_PAGE_COMMAND,
      () => {
        vscode.window.showWarningMessage(
          'The "Foam: Export to HTML page" command has been renamed to "Foam: Export to HTML page". The old name will be removed in a future release.'
        );
        return handler(DEPRECATED_PUBLISH_HTML_PAGE_COMMAND);
      }
    )
  );
}

async function runExportHtmlPage(foam: Foam): Promise<void> {
  const entryPoint = await pickEntryPoint(foam);
  if (!entryPoint) return;

  const depth = await pickDepth();
  if (depth === undefined) return;

  const candidates = collectNoteSet(foam.workspace, foam.graph, entryPoint, depth);
  if (candidates.length === 0) {
    vscode.window.showWarningMessage(
      'Foam: no notes found from this entry point.'
    );
    return;
  }

  const selected = await pickIncludedNotes(foam, candidates);
  if (!selected || selected.length === 0) return;

  const entryResource = foam.workspace.find(entryPoint);
  const defaultTitle = entryResource?.title ?? 'Foam Report';
  const title = await pickTitle(defaultTitle);
  if (title === undefined) return;

  // Default filename derives from the title the user typed so renamed reports
  // get matching files (e.g. "Q2 Memo" → `q2-memo.html`). Falls back to the
  // entry note's slug when the title is empty after slugging.
  const titleSlug = toSlug(title);
  // Slug the entry-point against its own directory so the fallback is just
  // the basename (`intro.html`) instead of an absolute-path slug.
  const entryDir = entryPoint.path.replace(/\/[^/]*$/, '');
  const fallbackSlug = slugForUri(entryPoint, entryDir);
  const defaultName = `${titleSlug || fallbackSlug}.html`;
  const savePath = await pickSaveLocation(defaultName);
  if (!savePath) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Foam: creating report…',
      cancellable: false,
    },
    async () => {
      const noteContent = await loadNoteContents(foam, selected);
      const html = await renderReport({
        workspace: foam.workspace,
        graph: foam.graph,
        parser: foam.services.parser,
        noteUris: selected,
        noteContent,
        title,
        generatedAt: new Date(),
        readAttachment: async (uri: URI) => {
          try {
            return await fs.readFile(uri.toFsPath());
          } catch {
            return null;
          }
        },
      });
      await fs.writeFile(savePath.toFsPath(), html, 'utf8');
    }
  );

  const open = await vscode.window.showInformationMessage(
    `Report saved to ${vscode.workspace.asRelativePath(toVsCodeUri(savePath))}`,
    'Open in browser',
    'Reveal in explorer'
  );
  if (open === 'Open in browser') {
    await vscode.env.openExternal(toVsCodeUri(savePath));
  } else if (open === 'Reveal in explorer') {
    await vscode.commands.executeCommand(
      'revealFileInOS',
      toVsCodeUri(savePath)
    );
  }
}

async function pickEntryPoint(foam: Foam): Promise<URI | undefined> {
  const editor = vscode.window.activeTextEditor;
  const fromEditor = editor
    ? foam.workspace.find(fromVsCodeUri(editor.document.uri))
    : null;

  const choices: vscode.QuickPickItem[] = [];
  if (fromEditor && fromEditor.type === 'note') {
    choices.push({
      label: `$(file) Use current note: ${fromEditor.title}`,
      description: vscode.workspace.asRelativePath(
        toVsCodeUri(fromEditor.uri)
      ),
    });
  }
  choices.push({ label: '$(search) Pick a note from the workspace…' });

  const picked = await vscode.window.showQuickPick(choices, {
    title: 'Foam: Export to HTML page — choose entry point',
    placeHolder: 'Pick the note the report should start from',
  });
  if (!picked) return undefined;

  if (picked === choices[0] && fromEditor) {
    return fromEditor.uri;
  }
  return pickWorkspaceNote(foam);
}

async function pickWorkspaceNote(foam: Foam): Promise<URI | undefined> {
  const notes = foam.workspace.list().filter(r => r.type === 'note');
  const items = notes
    .map(r => ({
      label: r.title,
      description: vscode.workspace.asRelativePath(toVsCodeUri(r.uri)),
      uri: r.uri,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const picked = await vscode.window.showQuickPick(items, {
    title: 'Foam: Export to HTML page — choose entry point',
    placeHolder: 'Type to search for a note',
    matchOnDescription: true,
  });
  return picked?.uri;
}

async function pickDepth(): Promise<number | undefined> {
  const input = await vscode.window.showInputBox({
    title: 'Foam: Export to HTML page — traversal depth',
    prompt: 'How many levels of outgoing links to follow from the entry point',
    value: String(DEFAULT_DEPTH),
    validateInput: value => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        return 'Enter a non-negative integer';
      }
      return null;
    },
  });
  if (input === undefined) return undefined;
  return Number(input);
}

async function pickIncludedNotes(
  foam: Foam,
  candidates: URI[]
): Promise<URI[] | undefined> {
  const items = candidates.map(uri => {
    const resource = foam.workspace.find(uri);
    return {
      label: resource?.title ?? uri.getBasename(),
      description: vscode.workspace.asRelativePath(toVsCodeUri(uri)),
      uri,
      picked: true,
    };
  });
  const picked = await vscode.window.showQuickPick(items, {
    title: `Foam: Export to HTML page — choose notes to include (${items.length} found)`,
    placeHolder: 'Uncheck notes to exclude from the report',
    canPickMany: true,
    matchOnDescription: true,
  });
  return picked?.map(i => i.uri);
}

async function pickTitle(defaultValue: string): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    title: 'Foam: Export to HTML page — title',
    prompt: 'Title shown at the top of the report (and used for the default filename)',
    value: defaultValue,
    validateInput: value =>
      value.trim().length === 0 ? 'Title cannot be empty' : null,
  });
  if (input === undefined) return undefined;
  return input.trim();
}

async function pickSaveLocation(
  defaultName: string
): Promise<URI | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultUri = root
    ? vscode.Uri.joinPath(root, defaultName)
    : vscode.Uri.file(defaultName);
  const result = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'HTML Document': ['html'] },
    saveLabel: 'Save report',
  });
  return result ? fromVsCodeUri(result) : undefined;
}

async function loadNoteContents(
  foam: Foam,
  uris: URI[]
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    uris.map(async uri => {
      const text = await foam.services.dataStore.read(uri);
      return [uri.toString(), text ?? ''] as const;
    })
  );
  return new Map(entries);
}
