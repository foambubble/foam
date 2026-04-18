import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { Range } from '@foam/core';
import { Logger } from '@foam/core';
import { fromVsCodeUri, toVsCodeRange } from '../../utils/vsc-utils';
import { MarkdownLink } from '@foam/core';
import { getTelemetry } from '../../services/telemetry';

export const CONVERT_WIKILINK_TO_MDLINK = {
  command: 'foam-vscode.convert-wikilink-to-mdlink',
  title: 'Foam: Convert Wikilink to Markdown Link',
};

export const CONVERT_MDLINK_TO_WIKILINK = {
  command: 'foam-vscode.convert-mdlink-to-wikilink',
  title: 'Foam: Convert Markdown Link to Wikilink',
};

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.commands.registerCommand(CONVERT_WIKILINK_TO_MDLINK.command, () => {
      getTelemetry()?.trackCommand(CONVERT_WIKILINK_TO_MDLINK.command);
      return convertWikilinkToMarkdown(foam);
    }),

    vscode.commands.registerCommand(CONVERT_MDLINK_TO_WIKILINK.command, () => {
      getTelemetry()?.trackCommand(CONVERT_MDLINK_TO_WIKILINK.command);
      return convertMarkdownToWikilink(foam);
    })
  );
}

async function convertWikilinkToMarkdown(foam: Foam): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  const document = activeEditor.document;
  const position = activeEditor.selection.active;
  const foamPosition = { line: position.line, character: position.character };

  try {
    const documentUri = fromVsCodeUri(document.uri);
    // Re-parse from current text to handle dirty editor state
    const resource = foam.services.parser.parse(documentUri, document.getText());
    const targetLink = resource.links.find(
      link =>
        link.type === 'wikilink' &&
        Range.containsPosition(link.range, foamPosition)
    );

    if (!targetLink) {
      vscode.window.showInformationMessage(
        'No wikilink found at cursor position'
      );
      return;
    }

    const linkInfo = MarkdownLink.analyzeLink(targetLink);
    const targetResource = foam.workspace.find(linkInfo.target);
    if (!targetResource) {
      throw new Error(`Resource "${linkInfo.target}" not found`);
    }

    const currentDirectory = documentUri.getDirectory();
    const relativePath = targetResource.uri.relativeTo(currentDirectory).path;
    const defaultAlias = linkInfo.section
      ? `${targetResource.title}#${linkInfo.section}`
      : targetResource.title;
    const alias = linkInfo.alias ? linkInfo.alias : defaultAlias;

    const edit = MarkdownLink.createUpdateLinkEdit(targetLink, {
      type: 'link',
      target: relativePath,
      alias,
    });

    const range = toVsCodeRange(edit.range);
    const success = await activeEditor.edit(editBuilder => {
      editBuilder.replace(range, edit.newText);
    });

    if (success) {
      const newEndPosition = new vscode.Position(
        range.start.line,
        range.start.character + edit.newText.length
      );
      activeEditor.selection = new vscode.Selection(
        newEndPosition,
        newEndPosition
      );
    }
  } catch (error) {
    Logger.error('Failed to convert wikilink to markdown link', error);
    vscode.window.showErrorMessage(
      `Failed to convert wikilink to markdown link: ${error.message}`
    );
  }
}

async function convertMarkdownToWikilink(foam: Foam): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  const document = activeEditor.document;
  const position = activeEditor.selection.active;
  const foamPosition = { line: position.line, character: position.character };

  try {
    const documentUri = fromVsCodeUri(document.uri);
    // Re-parse from current text to handle dirty editor state
    const resource = foam.services.parser.parse(documentUri, document.getText());
    const targetLink = resource.links.find(
      link =>
        link.type === 'link' &&
        Range.containsPosition(link.range, foamPosition)
    );

    if (!targetLink) {
      vscode.window.showInformationMessage(
        'No markdown link found at cursor position'
      );
      return;
    }

    const linkInfo = MarkdownLink.analyzeLink(targetLink);
    // resolveLink may embed the section as a URI fragment; strip it to get the resource URI
    const targetUri = foam.workspace
      .resolveLink(resource, targetLink)
      .asPlain();
    const targetResource = foam.workspace.get(targetUri);

    if (!targetResource) {
      throw new Error(`Resource not found: ${targetUri.path}`);
    }

    const identifier = foam.workspace.getIdentifier(targetResource.uri);
    const defaultAlias = linkInfo.section
      ? `${targetResource.title}#${linkInfo.section}`
      : targetResource.title;
    const alias =
      linkInfo.alias && linkInfo.alias !== defaultAlias ? linkInfo.alias : '';

    const edit = MarkdownLink.createUpdateLinkEdit(targetLink, {
      type: 'wikilink',
      target: identifier,
      alias,
    });

    const range = toVsCodeRange(edit.range);
    const success = await activeEditor.edit(editBuilder => {
      editBuilder.replace(range, edit.newText);
    });

    if (success) {
      const newEndPosition = new vscode.Position(
        range.start.line,
        range.start.character + edit.newText.length
      );
      activeEditor.selection = new vscode.Selection(
        newEndPosition,
        newEndPosition
      );
    }
  } catch (error) {
    Logger.error('Failed to convert markdown link to wikilink', error);
    vscode.window.showErrorMessage(
      `Failed to convert markdown link to wikilink: ${error.message}`
    );
  }
}
