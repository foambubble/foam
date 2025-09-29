import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { ResourceLink } from '../../core/model/note';
import { convertLinkFormat } from '../../core/janitor/convert-links-format';
import { fromVsCodeUri } from '../../utils/vsc-utils';
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
  const line = document.lineAt(position.line);
  const lineText = line.text;

  // Find wikilink at cursor position
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  let match;
  let targetRange: vscode.Range | undefined;
  let wikilinkContent: string | undefined;

  while ((match = wikilinkRegex.exec(lineText)) !== null) {
    const startChar = match.index;
    const endChar = match.index + match[0].length;
    const range = new vscode.Range(
      position.line,
      startChar,
      position.line,
      endChar
    );

    // Check if cursor is within this wikilink
    if (position.character >= startChar && position.character <= endChar) {
      targetRange = range;
      wikilinkContent = match[0];
      break;
    }
  }

  if (!targetRange || !wikilinkContent) {
    vscode.window.showInformationMessage(
      'No wikilink found at cursor position'
    );
    return;
  }

  try {
    // Parse the wikilink content to extract target and alias
    const wikilinkMatch = wikilinkContent.match(
      /^\[\[([^\|\]]+)(?:\|([^\]]+))?\]\]$/
    );
    if (!wikilinkMatch) {
      vscode.window.showInformationMessage('Invalid wikilink format');
      return;
    }

    const targetId = wikilinkMatch[1].trim();
    const alias = wikilinkMatch[2]?.trim();

    // Find the target resource in the workspace
    const targetResource = foam.workspace.find(targetId);
    if (!targetResource) {
      vscode.window.showErrorMessage(`Target resource "${targetId}" not found`);
      return;
    }

    // Create markdown link format
    const currentFileUri = fromVsCodeUri(activeEditor.document.uri);
    const currentDirectory = currentFileUri.getDirectory();
    const relativePath = targetResource.uri.relativeTo(currentDirectory).path;
    const linkText = alias || targetResource.title;
    const markdownLink = `[${linkText}](${relativePath})`;

    // Replace the wikilink with markdown format
    await activeEditor.edit(editBuilder => {
      editBuilder.replace(targetRange!, markdownLink);
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
  const line = document.lineAt(position.line);
  const lineText = line.text;

  // Find markdown link at cursor position
  const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  let targetRange: vscode.Range | undefined;
  let markdownContent: string | undefined;

  while ((match = markdownLinkRegex.exec(lineText)) !== null) {
    const startChar = match.index;
    const endChar = match.index + match[0].length;
    const range = new vscode.Range(
      position.line,
      startChar,
      position.line,
      endChar
    );

    // Check if cursor is within this markdown link
    if (position.character >= startChar && position.character <= endChar) {
      targetRange = range;
      markdownContent = match[0];
      break;
    }
  }

  if (!targetRange || !markdownContent) {
    vscode.window.showInformationMessage(
      'No markdown link found at cursor position'
    );
    return;
  }

  try {
    // Parse the markdown link content to extract text and URL
    const markdownMatch = markdownContent.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (!markdownMatch) {
      vscode.window.showInformationMessage('Invalid markdown link format');
      return;
    }

    const linkText = markdownMatch[1].trim();
    let linkUrl = markdownMatch[2].trim();

    // Remove angle brackets if present
    if (linkUrl.startsWith('<') && linkUrl.endsWith('>')) {
      linkUrl = linkUrl.slice(1, -1);
    }

    // Try to find the resource by the link URL (identifier)
    let targetResource = foam.workspace.find(linkUrl);

    // If not found by identifier, try by full path
    if (!targetResource) {
      // Remove .md extension if present and try again
      const withoutExt = linkUrl.replace(/\.md$/, '');
      targetResource = foam.workspace.find(withoutExt);
    }

    if (!targetResource) {
      vscode.window.showErrorMessage(
        `Target resource for "${linkUrl}" not found`
      );
      return;
    }

    // Create wikilink format
    const identifier = foam.workspace.getIdentifier(targetResource.uri);
    let wikilinkContent;

    // Use alias if the link text differs from the resource title
    if (linkText && linkText !== targetResource.title) {
      wikilinkContent = `[[${identifier}|${linkText}]]`;
    } else {
      wikilinkContent = `[[${identifier}]]`;
    }

    // Replace the markdown link with wikilink format
    await activeEditor.edit(editBuilder => {
      editBuilder.replace(targetRange!, wikilinkContent);
    });
  } catch (e) {
    Logger.debug('Markdown to wikilink conversion failed:', e);
    vscode.window.showErrorMessage(
      'Failed to convert markdown link to wikilink'
    );
  }
}
