import { uniq } from 'lodash';
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
import {
  getText,
  hasEmptyTrailing,
  isMdEditor,
  mdDocSelector,
} from '../../utils';
import {
  getWikilinkDefinitionSetting,
  LinkReferenceDefinitionsSetting,
} from '../../settings';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from '../../core/services/markdown-provider';
import {
  LINK_REFERENCE_DEFINITION_FOOTER,
  LINK_REFERENCE_DEFINITION_HEADER,
} from '../../core/janitor/generate-link-references';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { URI } from '../../core/model/uri';
import { getEditorEOL } from '../../services/editor';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    commands.registerCommand('foam-vscode.update-wikilinks', () =>
      updateReferenceList(foam.workspace)
    ),
    workspace.onWillSaveTextDocument(e => {
      if (
        e.document.languageId === 'markdown' &&
        foam.services.matcher.isMatch(fromVsCodeUri(e.document.uri))
      ) {
        e.waitUntil(updateReferenceList(foam.workspace));
      }
    }),
    languages.registerCodeLensProvider(
      mdDocSelector,
      new WikilinkReferenceCodeLensProvider(foam.workspace)
    )
  );
}

async function createReferenceList(fWorkspace: FoamWorkspace, eol: string) {
  const editor = window.activeTextEditor;

  if (!editor || !isMdEditor(editor)) {
    return;
  }

  const refs = await generateReferenceList(
    fWorkspace,
    fromVsCodeUri(editor.document.uri)
  );
  if (refs && refs.length) {
    await editor.edit(function (editBuilder) {
      if (editor) {
        const spacing = hasEmptyTrailing(editor.document) ? eol : eol + eol;

        editBuilder.insert(
          new Position(editor.document.lineCount, 0),
          spacing + refs.join(eol)
        );
      }
    });
  }
}

async function updateReferenceList(fWorkspace: FoamWorkspace) {
  const editor = window.activeTextEditor;

  if (!editor || !isMdEditor(editor)) {
    return;
  }

  const eol = getEditorEOL();
  const doc = editor.document;
  const range = detectReferenceListRange(doc.getText(), eol);

  if (!range) {
    await createReferenceList(fWorkspace, eol);
  } else {
    const refs = generateReferenceList(fWorkspace, fromVsCodeUri(doc.uri));

    // references must always be preceded by an empty line
    const spacing = doc.lineAt(range.start.line - 1).isEmptyOrWhitespace
      ? ''
      : eol;

    await editor.edit(editBuilder => {
      editBuilder.replace(range, spacing + refs.join(eol));
    });
  }
}

function generateReferenceList(fWorkspace: FoamWorkspace, uri: URI): string[] {
  const wikilinkSetting = getWikilinkDefinitionSetting();

  if (wikilinkSetting === LinkReferenceDefinitionsSetting.off) {
    return [];
  }

  const note = fWorkspace.get(uri);

  // Should never happen as `doc` is usually given by `editor.document`, which
  // binds to an opened note.
  if (!note) {
    console.warn(
      `Can't find note for URI ${uri.path} before attempting to generate its markdown reference list`
    );
    return [];
  }

  const references = uniq(
    createMarkdownReferences(
      fWorkspace,
      note.uri,
      wikilinkSetting === LinkReferenceDefinitionsSetting.withExtensions
    ).map(stringifyMarkdownLinkReferenceDefinition)
  );

  if (references.length) {
    return [
      LINK_REFERENCE_DEFINITION_HEADER,
      ...references,
      LINK_REFERENCE_DEFINITION_FOOTER,
    ];
  }

  return [];
}

/**
 * Find the range of existing reference list
 * @param doc
 */
function detectReferenceListRange(text: string, eol: string): Range | null {
  const headerIndex = text.indexOf(LINK_REFERENCE_DEFINITION_HEADER);
  const footerIndex = text.lastIndexOf(LINK_REFERENCE_DEFINITION_FOOTER);

  if (headerIndex < 0) {
    return null;
  }

  const headerLine = text.substring(0, headerIndex).split(eol).length - 1;

  const footerLine = text.substring(0, footerIndex).split(eol).length - 1;

  if (headerLine >= footerLine) {
    return null;
  }

  return new Range(
    new Position(headerLine, 0),
    new Position(footerLine, LINK_REFERENCE_DEFINITION_FOOTER.length)
  );
}

class WikilinkReferenceCodeLensProvider implements CodeLensProvider {
  private foam: FoamWorkspace;

  constructor(foam: FoamWorkspace) {
    this.foam = foam;
  }

  public provideCodeLenses(
    document: TextDocument,
    _: CancellationToken
  ): CodeLens[] | Promise<CodeLens[]> {
    const eol = getEditorEOL();
    const range = detectReferenceListRange(document.getText(), eol);
    if (!range) {
      return [];
    }

    const refs = generateReferenceList(this.foam, fromVsCodeUri(document.uri));
    const oldRefs = getText(range).replace(/\r?\n|\r/g, eol);
    const newRefs = refs.join(eol);

    const status = oldRefs === newRefs ? 'up to date' : 'out of date';

    return [
      new CodeLens(range, {
        arguments: [],
        title: `Link references (${status})`,
        command: '',
      }),
    ];
  }
}
