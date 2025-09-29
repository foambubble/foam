import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { ResourceLink } from '../../core/model/note';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Range } from '../../core/model/range';
import { fromVsCodeUri, toVsCodeRange } from '../../utils/vsc-utils';
import { Logger } from '../../core/utils/log';

export const CONVERT_WIKILINK_TO_MARKDOWN = {
  command: 'foam-vscode.convert-wikilink-to-markdown',
  title: 'Foam: Convert Wikilink to Markdown Link',
};

export const CONVERT_MARKDOWN_TO_WIKILINK = {
  command: 'foam-vscode.convert-markdown-to-wikilink',
  title: 'Foam: Convert Markdown Link to Wikilink',
};

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
    // Parse the document to get all links using Foam's parser
    const documentUri = fromVsCodeUri(document.uri);
    const resource = foam.services.parser.parse(
      documentUri,
      document.getText()
    );

    // Find the link at cursor position
    const targetLink: ResourceLink | undefined = resource.links.find(
      link =>
        link.type === 'wikilink' &&
        Range.containsPosition(link.range, {
          line: position.line,
          character: position.character,
        })
    );

    if (!targetLink) {
      vscode.window.showInformationMessage(
        'No wikilink found at cursor position'
      );
      return;
    }

    // Parse the link to get target and alias information
    const linkInfo = MarkdownLink.analyzeLink(targetLink);

    // Find the target resource in the workspace
    const targetResource = foam.workspace.find(linkInfo.target);
    if (!targetResource) {
      vscode.window.showErrorMessage(`Resource "${linkInfo.target}" not found`);
      return;
    }

    const currentDirectory = documentUri.getDirectory();
    const relativePath = targetResource.uri.relativeTo(currentDirectory).path;

    const alias = linkInfo.alias ? linkInfo.alias : targetResource.title;
    const edit = MarkdownLink.createUpdateLinkEdit(targetLink, {
      type: 'link',
      target: relativePath,
      alias: alias,
    });

    await activeEditor.edit(editBuilder => {
      const range = toVsCodeRange(edit.range);
      editBuilder.replace(range, edit.newText);
    });
  } catch (e) {
    Logger.debug('Wikilink to markdown conversion failed:', e);
    vscode.window.showErrorMessage(
      'Failed to convert wikilink to markdown link'
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
    // Parse the document to get all links using Foam's parser
    const documentUri = fromVsCodeUri(document.uri);
    const resource = foam.services.parser.parse(
      documentUri,
      document.getText()
    );

    // Find the link at cursor position
    const targetLink: ResourceLink | undefined = resource.links.find(
      link =>
        link.type === 'link' && Range.containsPosition(link.range, position)
    );

    if (!targetLink) {
      vscode.window.showInformationMessage(
        'No markdown link found at cursor position'
      );
      return;
    }

    // Parse the link to get target and alias information
    const linkInfo = MarkdownLink.analyzeLink(targetLink);

    // Try to resolve the target resource from the link
    const targetUri = foam.workspace.resolveLink(resource, targetLink);
    const targetResource = foam.workspace.get(targetUri);

    if (!targetResource) {
      vscode.window.showErrorMessage(
        `Target resource for "${linkInfo.target}" not found`
      );
      return;
    }

    // Get the workspace identifier for the target resource
    const identifier = foam.workspace.getIdentifier(targetResource.uri);

    // Create the text edit using Foam's link creation utility
    const edit = MarkdownLink.createUpdateLinkEdit(targetLink, {
      type: 'wikilink',
      target: identifier,
      alias:
        linkInfo.alias && linkInfo.alias !== targetResource.title
          ? linkInfo.alias
          : '',
    });

    // Apply the edit to the document
    await activeEditor.edit(editBuilder => {
      editBuilder.replace(toVsCodeRange(edit.range), edit.newText);
    });
  } catch (e) {
    Logger.debug('Markdown to wikilink conversion failed:', e);
    vscode.window.showErrorMessage(
      'Failed to convert markdown link to wikilink: ' + e.message
    );
  }
}
