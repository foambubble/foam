import { URI } from '../core/model/uri';
import { existsSync } from 'fs';
import * as path from 'path';
import { isAbsolute } from 'path';
import { TextEncoder } from 'util';
import {
  commands,
  ExtensionContext,
  QuickPickItem,
  Selection,
  SnippetString,
  TextDocument,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from 'vscode';
import { FoamFeature } from '../types';
import { focusNote } from '../utils';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';

interface FoamSelectionContent {
  document: TextDocument;
  selection: Selection;
  content: string;
}

export function findSelectionContent(): FoamSelectionContent | undefined {
  const editor = window.activeTextEditor;
  if (editor === undefined) {
    return undefined;
  }

  const document = editor.document;
  const selection = editor.selection;

  if (!document || selection.isEmpty) {
    return undefined;
  }

  return {
    document,
    selection,
    content: document.getText(selection),
  };
}

export async function createDocAndFocus(
  templateSnippet: SnippetString,
  filepath: URI,
  viewColumn: ViewColumn = ViewColumn.Active
) {
  await workspace.fs.writeFile(
    toVsCodeUri(filepath),
    new TextEncoder().encode('')
  );
  await focusNote(filepath, true, viewColumn);
  await window.activeTextEditor.insertSnippet(templateSnippet);
}

export async function replaceSelection(
  document: TextDocument,
  selection: Selection,
  content: string
) {
  const originatingFileEdit = new WorkspaceEdit();
  originatingFileEdit.replace(document.uri, selection, content);
  await workspace.applyEdit(originatingFileEdit);
}
