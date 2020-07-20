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
  createNoteFromMarkdown,
  NoteGraph,
  Foam
} from "foam-core";
import { basename } from "path";
import {
  hasEmptyTrailing,
  docConfig,
  loadDocConfig,
  isMdEditor,
  mdDocSelector,
  getText,
  dropExtension
} from "../utils";
import { FoamFeature } from "../types";

const feature: FoamFeature = {
  activate: async (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.update-wikilinks", () =>
        updateReferenceList(foam.notes)
      ),
      workspace.onWillSaveTextDocument(e => {
        if (e.document.languageId === "markdown") {
          foam.notes.setNote(
            createNoteFromMarkdown(
              e.document.fileName,
              e.document.getText(),
              docConfig.eol
            )
          );
          e.waitUntil(updateReferenceList(foam.notes));
        }
      }),
      languages.registerCodeLensProvider(
        mdDocSelector,
        new WikilinkReferenceCodeLensProvider(foam.notes)
      )
    );
  }
};

const REFERENCE_HEADER = `[//begin]: # "Autogenerated link references for markdown compatibility"`;
const REFERENCE_FOOTER = `[//end]: # "Autogenerated link references"`;

async function createReferenceList(foam: NoteGraph) {
  let editor = window.activeTextEditor;
  if (!editor || !isMdEditor(editor)) {
    return;
  }

  let refs = await generateReferenceList(foam, editor.document);
  if (refs && refs.length) {
    await editor.edit(function(editBuilder) {
      if (editor) {
        const spacing = hasEmptyTrailing
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

async function updateReferenceList(foam: NoteGraph) {
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
    const refs = await generateReferenceList(foam, doc);

    // references must always be preceded by an empty line
    const spacing = doc.lineAt(range.start.line - 1).isEmptyOrWhitespace
      ? ""
      : docConfig.eol;

    await editor.edit(editBuilder => {
      editBuilder.replace(range, spacing + refs.join(docConfig.eol));
    });
  }
}

enum LinkReferenceDefinitionsSetting {
  withExtensions = "withExtensions",
  withoutExtensions = "withoutExtensions"
}

async function generateReferenceList(
  foam: NoteGraph,
  doc: TextDocument
): Promise<string[]> {
  const filePath = doc.fileName;

  const id = dropExtension(basename(filePath));

  const linkDefinitionSetting: LinkReferenceDefinitionsSetting =
    workspace
      .getConfiguration("foam.edit")
      .get<LinkReferenceDefinitionsSetting>("linkReferenceDefinitions") ??
    LinkReferenceDefinitionsSetting.withoutExtensions;

  const includeExtensions =
    linkDefinitionSetting === LinkReferenceDefinitionsSetting.withExtensions;
  const references = uniq(
    createMarkdownReferences(foam, id, includeExtensions).map(
      stringifyMarkdownLinkReferenceDefinition
    )
  );

  if (references.length) {
    return [REFERENCE_HEADER, ...references, REFERENCE_FOOTER];
  }

  return [];
}

/**
 * Find the range of existing reference list
 * @param doc
 */
function detectReferenceListRange(doc: TextDocument): Range {
  const fullText = doc.getText();

  const headerIndex = fullText.indexOf(REFERENCE_HEADER);
  const footerIndex = fullText.lastIndexOf(REFERENCE_FOOTER);

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
    new Position(footerLine, REFERENCE_FOOTER.length)
  );
}

class WikilinkReferenceCodeLensProvider implements CodeLensProvider {
  private foam: NoteGraph;

  constructor(foam: NoteGraph) {
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

    return generateReferenceList(this.foam, document).then(refs => {
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
    });
  }
}

export default feature;
