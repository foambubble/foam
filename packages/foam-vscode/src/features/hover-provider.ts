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
    const { section: linkFragment } = MarkdownLink.analyzeLink(targetLink);
    let backlinks: import('../core/model/graph').Connection[];
    if (linkFragment) {
      // Get all backlinks to the file, then filter by the exact target URI (including fragment).
      // This is simple and robust, avoiding the complex logic of the old getBlockIdBacklinks.
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
      const targetFileUri = targetUri.with({ fragment: '' });
      const targetResource = this.workspace.get(targetFileUri);
      let content: string;

      if (linkFragment) {
        const section = Resource.findSection(targetResource, linkFragment);
        if (isSome(section)) {
          if (section.isHeading) {
            const fileContent = await this.workspace.readAsMarkdown(
              targetFileUri
            );
            content = sliceContent(fileContent, section.range);
          } else {
            content = section.label;
          }
        } else {
          content = await this.workspace.readAsMarkdown(targetFileUri);
        }
        // Remove YAML frontmatter from the content
        if (isSome(content)) {
          content = content.replace(/---[\s\S]*?---/, '').trim();
        }
      } else {
        content = await this.workspace.readAsMarkdown(targetFileUri);
        // Remove YAML frontmatter from the content
        if (isSome(content)) {
          content = content.replace(/---[\s\S]*?---/, '').trim();
        }
      }

      if (isSome(content)) {
        const markdownString = new vscode.MarkdownString(content);
        markdownString.isTrusted = true;
        mdContent = markdownString;
      } else {
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
