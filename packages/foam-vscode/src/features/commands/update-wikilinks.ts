import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  commands,
  ExtensionContext,
  languages,
  Range,
  TextDocument,
  window,
  workspace,
  Position,
} from 'vscode';
import { isMdEditor, mdDocSelector } from '../../utils';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import {
  LINK_REFERENCE_DEFINITION_FOOTER,
  LINK_REFERENCE_DEFINITION_HEADER,
  generateLinkReferences,
} from '../../core/janitor/generate-link-references';
import { fromVsCodeUri, toVsCodeRange } from '../../utils/vsc-utils';
import { getEditorEOL } from '../../services/editor';
import { ResourceParser } from '../../core/model/note';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    commands.registerCommand('foam-vscode.update-wikilinks', () =>
      updateReferenceList(foam.workspace, foam.services.parser)
    ),
    workspace.onWillSaveTextDocument(e => {
      if (
        e.document.languageId === 'markdown' &&
        foam.services.matcher.isMatch(fromVsCodeUri(e.document.uri))
      ) {
        e.waitUntil(updateReferenceList(foam.workspace, foam.services.parser));
      }
    }),
    languages.registerCodeLensProvider(
      mdDocSelector,
      new WikilinkReferenceCodeLensProvider(
        foam.workspace,
        foam.services.parser
      )
    )
  );
}

async function updateReferenceList(
  fWorkspace: FoamWorkspace,
  fParser: ResourceParser
) {
  const editor = window.activeTextEditor;

  if (!editor || !isMdEditor(editor)) {
    return;
  }

  const eol = getEditorEOL();
  const doc = editor.document;
  const text = doc.getText();
  const resource = fParser.parse(fromVsCodeUri(doc.uri), text);
  const update = await generateLinkReferences(
    resource,
    text,
    eol,
    fWorkspace,
    true
  );

  if (update) {
    await editor.edit(editBuilder => {
      const gap = doc.lineAt(update.range.start.line - 1).isEmptyOrWhitespace
        ? ''
        : eol;
      editBuilder.replace(toVsCodeRange(update.range), gap + update.newText);
    });
  }
}

/**
 * Find the range of existing reference list
 * @param doc
 */
function detectDocumentWikilinkDefinitions(text: string, eol: string) {
  const lines = text.split(eol);

  const headerLine = lines.findIndex(
    line => line === LINK_REFERENCE_DEFINITION_HEADER
  );
  const footerLine = lines.findIndex(
    line => line === LINK_REFERENCE_DEFINITION_FOOTER
  );

  if (headerLine < 0 || footerLine < 0 || headerLine >= footerLine) {
    return { range: null, definitions: null };
  }

  const range = new Range(
    new Position(headerLine, 0),
    new Position(footerLine, lines[footerLine].length)
  );
  const definitions = lines.slice(headerLine, footerLine).join(eol);

  return { range, definitions };
}

class WikilinkReferenceCodeLensProvider implements CodeLensProvider {
  constructor(
    private fWorkspace: FoamWorkspace,
    private fParser: ResourceParser
  ) {}

  public async provideCodeLenses(
    document: TextDocument,
    _: CancellationToken
  ): Promise<CodeLens[]> {
    const eol = getEditorEOL();
    const text = document.getText();

    const { range } = detectDocumentWikilinkDefinitions(text, eol);
    if (!range) {
      return [];
    }

    const resource = this.fParser.parse(fromVsCodeUri(document.uri), text);
    const update = await generateLinkReferences(
      resource,
      text,
      eol,
      this.fWorkspace,
      true
    );

    const status = update == null ? 'up to date' : 'out of date';

    return [
      new CodeLens(range, {
        arguments: [],
        title: `Wikilink definitions (${status})`,
        command: '',
      }),
    ];
  }
}
