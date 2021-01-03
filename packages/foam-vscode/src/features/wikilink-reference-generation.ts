import { uniq } from "lodash";
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
  Position
} from "vscode";

import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
  NoteGraphAPI,
  Foam,
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER
} from "foam-core";
import {
  hasEmptyTrailing,
  docConfig,
  loadDocConfig,
  isMdEditor,
  mdDocSelector,
  getText
} from "../utils";
import { FoamFeature } from "../types";
import {
  getWikilinkDefinitionSetting,
  LinkReferenceDefinitionsSetting
} from "../settings";

const feature: FoamFeature = {
  activate: async (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    const foam = await foamPromise;

    context.subscriptions.push(
      commands.registerCommand("foam-vscode.update-wikilinks", () =>
        updateReferenceList(foam.notes)
      ),

      workspace.onWillSaveTextDocument(e => {
        if (e.document.languageId === "markdown") {
          updateDocumentInNoteGraph(foam, e.document);
          e.waitUntil(updateReferenceList(foam.notes));
        }
      }),
      languages.registerCodeLensProvider(
        mdDocSelector,
        new WikilinkReferenceCodeLensProvider(foam.notes)
      )
    );

    // when a file is created as a result of peekDefinition
    // action on a wikilink, add definition update references
    foam.notes.onDidAddNote(_ => {
      let editor = window.activeTextEditor;
      if (!editor || !isMdEditor(editor)) {
        return;
      }

      updateDocumentInNoteGraph(foam, editor.document);
      updateReferenceList(foam.notes);
    });
  }
};

function updateDocumentInNoteGraph(foam: Foam, document: TextDocument) {
  foam.notes.setNote(
    foam.parse(document.uri, document.getText(), docConfig.eol)
  );
}

async function createReferenceList(foam: NoteGraphAPI) {
  let editor = window.activeTextEditor;

  if (!editor || !isMdEditor(editor)) {
    return;
  }

  let refs = await generateReferenceList(foam, editor.document);
  if (refs && refs.length) {
    await editor.edit(function(editBuilder) {
      if (editor) {
        const spacing = hasEmptyTrailing(editor.document)
          ? docConfig.eol
          : docConfig.eol + docConfig.eol;

        editBuilder.insert(
          new Position(editor.document.lineCount, 0),
          spacing + refs.join(docConfig.eol)
        );
      }
    });
  }
}

async function updateReferenceList(foam: NoteGraphAPI) {
  const editor = window.activeTextEditor;

  if (!editor || !isMdEditor(editor)) {
    return;
  }

  loadDocConfig();

  const doc = editor.document;
  const range = detectReferenceListRange(doc);

  if (!range) {
    await createReferenceList(foam);
  } else {
    const refs = generateReferenceList(foam, doc);

    // references must always be preceded by an empty line
    const spacing = doc.lineAt(range.start.line - 1).isEmptyOrWhitespace
      ? ""
      : docConfig.eol;

    await editor.edit(editBuilder => {
      editBuilder.replace(range, spacing + refs.join(docConfig.eol));
    });
  }
}

function generateReferenceList(
  foam: NoteGraphAPI,
  doc: TextDocument
): string[] {
  const wikilinkSetting = getWikilinkDefinitionSetting();

  if (wikilinkSetting === LinkReferenceDefinitionsSetting.off) {
    return [];
  }

  const note = foam.getNote(doc.uri);

  // Should never happen as `doc` is usually given by `editor.document`, which
  // binds to an opened note.
  if (!note) {
    console.warn(
      `Can't find note for URI ${doc.uri.path} before attempting to generate its markdown reference list`
    );
    return [];
  }

  const references = uniq(
    createMarkdownReferences(
      foam,
      note.uri,
      wikilinkSetting === LinkReferenceDefinitionsSetting.withExtensions
    ).map(stringifyMarkdownLinkReferenceDefinition)
  );

  if (references.length) {
    return [
      LINK_REFERENCE_DEFINITION_HEADER,
      ...references,
      LINK_REFERENCE_DEFINITION_FOOTER
    ];
  }

  return [];
}

/**
 * Find the range of existing reference list
 * @param doc
 */
function detectReferenceListRange(doc: TextDocument): Range | null {
  const fullText = doc.getText();

  const headerIndex = fullText.indexOf(LINK_REFERENCE_DEFINITION_HEADER);
  const footerIndex = fullText.lastIndexOf(LINK_REFERENCE_DEFINITION_FOOTER);

  if (headerIndex < 0) {
    return null;
  }

  const headerLine =
    fullText.substring(0, headerIndex).split(docConfig.eol).length - 1;

  const footerLine =
    fullText.substring(0, footerIndex).split(docConfig.eol).length - 1;

  if (headerLine >= footerLine) {
    return null;
  }

  return new Range(
    new Position(headerLine, 0),
    new Position(footerLine, LINK_REFERENCE_DEFINITION_FOOTER.length)
  );
}

class WikilinkReferenceCodeLensProvider implements CodeLensProvider {
  private foam: NoteGraphAPI;

  constructor(foam: NoteGraphAPI) {
    this.foam = foam;
  }

  public provideCodeLenses(
    document: TextDocument,
    _: CancellationToken
  ): CodeLens[] | Thenable<CodeLens[]> {
    loadDocConfig();

    let range = detectReferenceListRange(document);
    if (!range) {
      return [];
    }

    const refs = generateReferenceList(this.foam, document);
    const oldRefs = getText(range).replace(/\r?\n|\r/g, docConfig.eol);
    const newRefs = refs.join(docConfig.eol);

    let status = oldRefs === newRefs ? "up to date" : "out of date";

    return [
      new CodeLens(range, {
        arguments: [],
        title: `Link references (${status})`,
        command: ""
      })
    ];
  }
}

export default feature;
