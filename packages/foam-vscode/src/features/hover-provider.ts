import { uniqWith } from 'lodash';
import * as vscode from 'vscode';
import { fromVsCodeUri, toVsCodeRange } from '../utils/vsc-utils';
import {
  ConfigurationMonitor,
  monitorFoamVsCodeConfig,
} from '../services/config';
import { ResourceLink, ResourceParser } from '../core/model/note';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Range } from '../core/model/range';
import { FoamGraph } from '../core/model/graph';
import { OPEN_COMMAND } from './commands/open-resource';
import { CREATE_NOTE_COMMAND } from './commands/create-note';
import { commandAsURI } from '../utils/commands';
import { Location } from '../core/model/location';
import { getNoteTooltip, mdDocSelector } from '../services/editor';
import { isSome } from '../core/utils';

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
      mdDocSelector,
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
    const sources = uniqWith(
      this.graph
        .getBacklinks(targetUri)
        .filter(link => !link.source.isEqual(documentUri))
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
      const content: string = await this.workspace.readAsMarkdown(targetUri);

      mdContent = isSome(content)
        ? getNoteTooltip(content)
        : this.workspace.get(targetUri).title;
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
