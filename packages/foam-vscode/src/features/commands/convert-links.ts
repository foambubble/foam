import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { Resource, ResourceLink } from '../../core/model/note';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Range } from '../../core/model/range';
import { Position } from '../../core/model/position';
import { URI } from '../../core/model/uri';
import { fromVsCodeUri, toVsCodeRange } from '../../utils/vsc-utils';
import { Logger } from '../../core/utils/log';
import { TextEdit } from '../../core/services/text-edit';

export const CONVERT_WIKILINK_TO_MARKDOWN = {
  command: 'foam-vscode.convert-wikilink-to-markdown',
  title: 'Foam: Convert Wikilink to Markdown Link',
};

export const CONVERT_MARKDOWN_TO_WIKILINK = {
  command: 'foam-vscode.convert-markdown-to-wikilink',
  title: 'Foam: Convert Markdown Link to Wikilink',
};

/**
 * Pure function to convert a wikilink to markdown link at a specific position
 * Returns the TextEdit to apply, or null if no conversion is possible
 */
export function convertWikilinkToMarkdownAtPosition(
  documentText: string,
  documentUri: URI,
  linkPosition: Position,
  foamWorkspace: { find: (identifier: string) => Resource | null },
  foamParser: { parse: (uri: URI, text: string) => Resource }
): TextEdit | null {
  // Parse the document to get all links using Foam's parser
  const resource = foamParser.parse(documentUri, documentText);

  // Find the link at cursor position
  const targetLink: ResourceLink | undefined = resource.links.find(
    link =>
      link.type === 'wikilink' &&
      Range.containsPosition(link.range, linkPosition)
  );

  if (!targetLink) {
    return null;
  }

  // Parse the link to get target and alias information
  const linkInfo = MarkdownLink.analyzeLink(targetLink);

  // Find the target resource in the workspace
  const targetResource = foamWorkspace.find(linkInfo.target);
  if (!targetResource) {
    throw new Error(`Resource "${linkInfo.target}" not found`);
  }

  // Compute relative path from current file to target file
  const currentDirectory = documentUri.getDirectory();
  const relativePath = targetResource.uri.relativeTo(currentDirectory).path;

  const alias = linkInfo.alias ? linkInfo.alias : targetResource.title;
  return MarkdownLink.createUpdateLinkEdit(targetLink, {
    type: 'link',
    target: relativePath,
    alias: alias,
  });
}

/**
 * Pure function to convert a markdown link to wikilink at a specific position
 * Returns the TextEdit to apply, or null if no conversion is possible
 */
export function convertMarkdownToWikilinkAtPosition(
  documentText: string,
  documentUri: URI,
  cursorPosition: Position,
  foamWorkspace: {
    resolveLink: (resource: Resource, link: ResourceLink) => URI;
    get: (uri: URI) => Resource | null;
    getIdentifier: (uri: URI) => string;
  },
  foamParser: { parse: (uri: URI, text: string) => Resource }
): TextEdit | null {
  // Parse the document to get all links using Foam's parser
  const resource = foamParser.parse(documentUri, documentText);

  // Find the link at cursor position
  const targetLink: ResourceLink | undefined = resource.links.find(
    link =>
      link.type === 'link' && Range.containsPosition(link.range, cursorPosition)
  );

  if (!targetLink) {
    return null;
  }

  // Parse the link to get target and alias information
  const linkInfo = MarkdownLink.analyzeLink(targetLink);

  // Try to resolve the target resource from the link
  const targetUri = foamWorkspace.resolveLink(resource, targetLink);
  const targetResource = foamWorkspace.get(targetUri);

  if (!targetResource) {
    throw new Error(`Resource not found: ${targetUri.path}`);
  }

  // Get the workspace identifier for the target resource
  const identifier = foamWorkspace.getIdentifier(targetResource.uri);

  return MarkdownLink.createUpdateLinkEdit(targetLink, {
    type: 'wikilink',
    target: identifier,
    alias:
      linkInfo.alias && linkInfo.alias !== targetResource.title
        ? linkInfo.alias
        : '',
  });
}

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.commands.registerCommand(CONVERT_WIKILINK_TO_MARKDOWN.command, () =>
      convertWikilinkToMarkdown(foam)
    ),

    vscode.commands.registerCommand(CONVERT_MARKDOWN_TO_WIKILINK.command, () =>
      convertMarkdownToWikilink(foam)
    )
  );
}

/**
 * Convert wikilink at cursor position to markdown link format
 */
export async function convertWikilinkToMarkdown(foam: Foam): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  const document = activeEditor.document;
  const position = activeEditor.selection.active;

  try {
    const edit = convertWikilinkToMarkdownAtPosition(
      document.getText(),
      fromVsCodeUri(document.uri),
      {
        line: position.line,
        character: position.character,
      },
      foam.workspace,
      foam.services.parser
    );

    if (!edit) {
      vscode.window.showInformationMessage(
        'No wikilink found at cursor position'
      );
      return;
    }

    // Apply the edit to the document
    await activeEditor.edit(editBuilder => {
      const range = toVsCodeRange(edit.range);
      editBuilder.replace(range, edit.newText);
    });
  } catch (error) {
    Logger.error('Failed to convert wikilink to markdown link', error);
    vscode.window.showErrorMessage(
      `Failed to convert wikilink to markdown link: ${error.message}`
    );
  }
}

/**
 * Convert markdown link at cursor position to wikilink format
 */
export async function convertMarkdownToWikilink(foam: Foam): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  const document = activeEditor.document;
  const position = activeEditor.selection.active;

  try {
    const edit = convertMarkdownToWikilinkAtPosition(
      document.getText(),
      fromVsCodeUri(document.uri),
      {
        line: position.line,
        character: position.character,
      },
      foam.workspace,
      foam.services.parser
    );

    if (!edit) {
      vscode.window.showInformationMessage(
        'No markdown link found at cursor position'
      );
      return;
    }

    // Apply the edit to the document
    await activeEditor.edit(editBuilder => {
      editBuilder.replace(toVsCodeRange(edit.range), edit.newText);
    });
  } catch (error) {
    Logger.error('Failed to convert markdown link to wikilink', error);
    vscode.window.showErrorMessage(
      `Failed to convert markdown link to wikilink: ${error.message}`
    );
  }
}
