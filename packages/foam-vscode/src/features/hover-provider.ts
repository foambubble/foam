import { uniqWith } from 'lodash';
import * as vscode from 'vscode';
import { fromVsCodeUri, toVsCodeRange } from '../utils/vsc-utils';
import {
  ConfigurationMonitor,
  monitorFoamVsCodeConfig,
} from '../services/config';
import {
  ResourceLink,
  ResourceParser,
  Resource,
  Section,
} from '../core/model/note';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Range } from '../core/model/range';
import { FoamGraph } from '../core/model/graph';
import { OPEN_COMMAND } from './commands/open-resource';
import { CREATE_NOTE_COMMAND } from './commands/create-note';
import { commandAsURI } from '../utils/commands';
import { Location } from '../core/model/location';
import { getNoteTooltip, getFoamDocSelectors } from '../services/editor';
import { isSome } from '../core/utils';
import { MarkdownLink } from '../core/services/markdown-link';

/**
 * Extracts a range of content from a multi-line string.
 * This is used to display the content of a specific section (e.g., a heading and its content)
 * in the hover preview, rather than the entire note.
 * @param content The full string content of the note.
 * @param range The range to extract.
 * @returns The substring corresponding to the given range.
 */
const sliceContent = (content: string, range: Range): string => {
  const lines = content.split('\n');
  const { start, end } = range;

  if (start.line === end.line) {
    return lines[start.line]?.substring(start.character, end.character) ?? '';
  }

  const firstLine = lines[start.line]?.substring(start.character) ?? '';
  const lastLine = lines[end.line]?.substring(0, end.character) ?? '';
  const middleLines = lines.slice(start.line + 1, end.line);

  return [firstLine, ...middleLines, lastLine].join('\n');
};

export const CONFIG_KEY = 'links.hover.enable';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const isHoverEnabled: ConfigurationMonitor<boolean> =
    monitorFoamVsCodeConfig(CONFIG_KEY);

  const foam = await foamPromise;

  context.subscriptions.push(
    isHoverEnabled,
    vscode.languages.registerHoverProvider(
      getFoamDocSelectors(),
      new HoverProvider(
        isHoverEnabled,
        foam.workspace,
        foam.graph,
        foam.services.parser
      )
    )
  );
}

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private isHoverEnabled: () => boolean,
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private parser: ResourceParser
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover> {
    if (!this.isHoverEnabled()) {
      return;
    }

    const startResource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    const targetLink: ResourceLink | undefined = startResource.links.find(
      link =>
        Range.containsPosition(link.range, {
          line: position.line,
          character: position.character,
        })
    );
    if (!targetLink) {
      return;
    }

    const documentUri = fromVsCodeUri(document.uri);
    const targetUri = this.workspace.resolveLink(startResource, targetLink);

    // --- Start of Block ID Feature Changes ---

    // Extract the fragment (e.g., #my-header or #^my-block-id) from the link.
    // This is crucial for handling links to specific sections or blocks within a note.
    const { section: linkFragment } = MarkdownLink.analyzeLink(targetLink);

    let backlinks: import('../core/model/graph').Connection[];

    // If a fragment exists, we need to be more precise with backlink gathering.
    if (linkFragment) {
      backlinks = this.graph
        .getBacklinks(targetUri)
        .filter(conn => conn.target.isEqual(targetUri));
    } else {
      backlinks = this.graph.getBacklinks(targetUri);
    }
    const sources = uniqWith(
      backlinks
        .filter(link => link.source.toFsPath() !== documentUri.toFsPath())
        .map(link => link.source),
      (u1, u2) => u1.isEqual(u2)
    );

    const links = sources.slice(0, 10).map(ref => {
      const command = commandAsURI(OPEN_COMMAND.forURI(ref));
      return `- [${this.workspace.get(ref).title}](${command.toString()})`;
    });

    const notes = `note${sources.length > 1 ? 's' : ''}`;
    const references = getNoteTooltip(
      [
        `Also referenced in ${sources.length} ${notes}:`,
        ...links,
        links.length === sources.length ? '' : '- ...',
      ].join('\n')
    );

    let mdContent = null;
    if (!targetUri.isPlaceholder()) {
      // The URI for the file itself, without any fragment identifier.
      const targetFileUri = targetUri.with({ fragment: '' });
      const targetResource = this.workspace.get(targetFileUri);
      let content: string;

      // If the link includes a fragment, we display the content of that specific section.
      if (linkFragment) {
        const section = Resource.findSection(targetResource, linkFragment);
        if (isSome(section)) {
          // For headings, we read the file content and slice out the range of the section.
          // This includes the heading line and all content until the next heading.
          if (section.isHeading) {
            const fileContent = await this.workspace.readAsMarkdown(
              targetFileUri
            );
            content = sliceContent(fileContent, section.range);
          } else {
            // For block IDs, the `section.label` already contains the exact raw markdown
            // content of the block. This is a core principle of the block ID feature (WYSIWYL),
            // allowing for efficient and accurate hover previews without re-reading the file.
            content = section.label;
          }
        } else {
          // Fallback: if the specific section isn't found, show the whole note content.
          content = await this.workspace.readAsMarkdown(targetFileUri);
        }
        // Ensure YAML frontmatter is not included in the hover preview.
        if (isSome(content)) {
          content = content.replace(/---[\s\S]*?---/, '').trim();
        }
      } else {
        // If there is no fragment, show the entire note content, minus frontmatter.
        content = await this.workspace.readAsMarkdown(targetFileUri);
        if (isSome(content)) {
          content = content.replace(/---[\s\S]*?---/, '').trim();
        }
      }

      if (isSome(content)) {
        // Using vscode.MarkdownString allows for rich content rendering in the hover.
        // Setting `isTrusted` to true is necessary to enable command links within the hover.
        const markdownString = new vscode.MarkdownString(content);
        markdownString.isTrusted = true;
        mdContent = markdownString;
      } else {
        // If no content can be loaded, fall back to displaying the note's title.
        mdContent = targetResource.title;
      }
    }

    const command = CREATE_NOTE_COMMAND.forPlaceholder(
      Location.forObjectWithRange(documentUri, targetLink),
      this.workspace.defaultExtension,
      {
        askForTemplate: true,
        onFileExists: 'open',
      }
    );
    const newNoteFromTemplate = new vscode.MarkdownString(
      `[Create note from template for '${targetUri.getBasename()}'](${commandAsURI(
        command
      ).toString()})`
    );
    newNoteFromTemplate.isTrusted = true;

    const hover: vscode.Hover = {
      contents: [
        mdContent,
        sources.length > 0 ? references : null,
        targetUri.isPlaceholder() ? newNoteFromTemplate : null,
      ],
      range: toVsCodeRange(targetLink.range),
    };
    return hover;
  }
}
