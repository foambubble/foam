/**
 * @file Provides diagnostics for wikilinks in markdown files.
 * This includes:
 * - Detecting ambiguous links (when an identifier can resolve to multiple notes).
 * - Detecting broken section links (when the note exists but the #section does not).
 * - Providing Quick Fixes (Code Actions) to resolve these issues.
 */
import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { Resource, ResourceParser, ResourceLink } from '../core/model/note';
import { Range } from '../core/model/range';
import { FoamWorkspace } from '../core/model/workspace';
import { MarkdownLink } from '../core/services/markdown-link';
import {
  fromVsCodeUri,
  toVsCodePosition,
  toVsCodeRange,
  toVsCodeUri,
} from '../utils/vsc-utils';
import { isNone } from '../core/utils';

/**
 * Diagnostic code for an ambiguous link identifier.
 * Used when a wikilink could refer to more than one note.
 */
const AMBIGUOUS_IDENTIFIER_CODE = 'ambiguous-identifier';

/**
 * Diagnostic code for an unknown section in a wikilink.
 * Used when the note exists, but the section identifier (e.g., #my-section) does not.
 */
const UNKNOWN_SECTION_CODE = 'unknown-section';

interface FoamCommand<T> {
  name: string;
  execute: (params: T) => Promise<void>;
}

interface FindIdentifierCommandArgs {
  range: vscode.Range;
  target: vscode.Uri;
  defaultExtension: string;
  amongst: vscode.Uri[];
}

/**
 * A command that computes the shortest unambiguous identifier for a target URI
 * among a set of potential targets and replaces the text in the editor.
 * Used by the Quick Fix for ambiguous links.
 */
const FIND_IDENTIFIER_COMMAND: FoamCommand<FindIdentifierCommandArgs> = {
  name: 'foam:compute-identifier',
  execute: async ({ target, amongst, range, defaultExtension }) => {
    if (vscode.window.activeTextEditor) {
      let identifier = FoamWorkspace.getShortestIdentifier(
        target.path,
        amongst.map(uri => uri.path)
      );

      identifier = identifier.endsWith(defaultExtension)
        ? identifier.slice(0, defaultExtension.length * -1)
        : identifier;

      await vscode.window.activeTextEditor.edit(builder => {
        builder.replace(range, identifier);
      });
    }
  },
};

interface ReplaceTextCommandArgs {
  range: vscode.Range;
  value: string;
}

/**
 * A generic command that replaces a range of text in the active editor with a new value.
 * Used by the Quick Fix for unknown sections.
 */
const REPLACE_TEXT_COMMAND: FoamCommand<ReplaceTextCommandArgs> = {
  name: 'foam:replace-text',
  execute: async ({ range, value }) => {
    await vscode.window.activeTextEditor.edit(builder => {
      builder.replace(range, value);
    });
  },
};

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const collection = vscode.languages.createDiagnosticCollection('foam');
  const debouncedUpdateDiagnostics = debounce(updateDiagnostics, 500);
  const foam = await foamPromise;
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(
      foam.workspace,
      foam.services.parser,
      vscode.window.activeTextEditor.document,
      collection
    );
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        updateDiagnostics(
          foam.workspace,
          foam.services.parser,
          editor.document,
          collection
        );
      }
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      debouncedUpdateDiagnostics(
        foam.workspace,
        foam.services.parser,
        event.document,
        collection
      );
    }),
    vscode.languages.registerCodeActionsProvider(
      'markdown',
      new IdentifierResolver(foam.workspace, foam.workspace.defaultExtension),
      {
        providedCodeActionKinds: IdentifierResolver.providedCodeActionKinds,
      }
    ),
    vscode.commands.registerCommand(
      FIND_IDENTIFIER_COMMAND.name,
      FIND_IDENTIFIER_COMMAND.execute
    ),
    vscode.commands.registerCommand(
      REPLACE_TEXT_COMMAND.name,
      REPLACE_TEXT_COMMAND.execute
    )
  );
}

/**
 * Analyzes the current document for ambiguous or broken wikilinks and generates
 * corresponding diagnostics in the editor.
 * @param workspace The Foam workspace, used to resolve link targets.
 * @param parser The resource parser, used to get links from the document text.
 * @param document The document to analyze.
 * @param collection The diagnostic collection to update.
 */
export function updateDiagnostics(
  workspace: FoamWorkspace,
  parser: ResourceParser,
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  collection.clear();
  if (!document || document.languageId !== 'markdown') {
    return;
  }

  const resource = parser.parse(
    fromVsCodeUri(document.uri),
    document.getText()
  );

  const diagnostics = resource.links.flatMap(link => {
    if (link.type !== 'wikilink') {
      return [];
    }
    const { target, section } = MarkdownLink.analyzeLink(link);
    const targets = workspace.listByIdentifier(target);

    if (targets.length > 1) {
      return [createAmbiguousIdentifierDiagnostic(link, targets)];
    }
    if (section && targets.length === 1) {
      const targetResource = targets[0];
      if (isNone(Resource.findSection(targetResource, section))) {
        return [
          createUnknownSectionDiagnostic(link, target, section, targetResource),
        ];
      }
    }
    return [];
  });

  if (diagnostics.length > 0) {
    collection.set(document.uri, diagnostics);
  }
}

/**
 * Creates a VS Code Diagnostic for an ambiguous wikilink identifier.
 * @param link The wikilink that is ambiguous.
 * @param targets The list of potential resources the link could target.
 * @returns A `vscode.Diagnostic` object.
 */
function createAmbiguousIdentifierDiagnostic(
  link: ResourceLink,
  targets: Resource[]
): vscode.Diagnostic {
  return {
    code: AMBIGUOUS_IDENTIFIER_CODE,
    message: 'Resource identifier is ambiguous',
    range: toVsCodeRange(link.range),
    severity: vscode.DiagnosticSeverity.Warning,
    source: 'Foam',
    relatedInformation: targets.map(
      t =>
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(toVsCodeUri(t.uri), new vscode.Position(0, 0)),
          `Possible target: ${vscode.workspace.asRelativePath(
            toVsCodeUri(t.uri)
          )}`
        )
    ),
  };
}

/**
 * Creates a VS Code Diagnostic for a wikilink pointing to a non-existent section.
 * @param link The wikilink containing the broken section reference.
 * @param target The string identifier of the target note.
 * @param section The string identifier of the (non-existent) section.
 * @param resource The target resource where the section was not found.
 * @returns A `vscode.Diagnostic` object.
 */
function createUnknownSectionDiagnostic(
  link: ResourceLink,
  target: string,
  section: string,
  resource: Resource
): vscode.Diagnostic {
  const range = Range.create(
    link.range.start.line,
    link.range.start.character + target.length + 2,
    link.range.end.line,
    link.range.end.character
  );
  return {
    code: UNKNOWN_SECTION_CODE,
    message: `Cannot find section "${section}" in document, available sections are:`,
    range: toVsCodeRange(range),
    severity: vscode.DiagnosticSeverity.Warning,
    source: 'Foam',
    relatedInformation: createSectionSuggestions(resource),
  };
}

/**
 * Generates a list of suggested sections from a resource to be displayed
 * as related information in a diagnostic.
 * This helps the user see the available, valid sections in a note.
 * @param resource The resource to generate suggestions from.
 * @returns An array of `vscode.DiagnosticRelatedInformation` objects.
 */
function createSectionSuggestions(
  resource: Resource
): vscode.DiagnosticRelatedInformation[] {
  return resource.sections.flatMap(s => {
    const infos: vscode.DiagnosticRelatedInformation[] = [];
    const location = new vscode.Location(
      toVsCodeUri(resource.uri),
      toVsCodePosition(s.range.start)
    );
    switch (s.type) {
      case 'heading':
        if (s.id) {
          infos.push(
            new vscode.DiagnosticRelatedInformation(location, s.label) // Use s.label for heading suggestions, as Quick Fix uses this
          );
        }
        if (s.blockId) {
          infos.push(
            new vscode.DiagnosticRelatedInformation(location, s.blockId) // Use s.blockId for block IDs (including caret)
          );
        }
        break;
      case 'block':
        infos.push(
          new vscode.DiagnosticRelatedInformation(location, s.blockId) // For blocks, only blockId is relevant
        );
        break;
    }
    return infos;
  });
}

/**
 * Provides Code Actions (Quick Fixes) for the diagnostics created by this file.
 */
export class IdentifierResolver implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  constructor(
    private workspace: FoamWorkspace,
    private defaultExtension: string
  ) {}

  /**
   * This method is called by VS Code when the user's cursor is on a diagnostic.
   * It returns a list of applicable Quick Fixes.
   */
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    return context.diagnostics.flatMap(diagnostic => {
      switch (diagnostic.code) {
        case AMBIGUOUS_IDENTIFIER_CODE:
          return this.createAmbiguousIdentifierActions(diagnostic);
        case UNKNOWN_SECTION_CODE:
          return this.createUnknownSectionActions(diagnostic);
        default:
          return [];
      }
    });
  }

  /**
   * Creates the set of Quick Fixes for an `AMBIGUOUS_IDENTIFIER_CODE` diagnostic.
   * This generates one Code Action for each potential target file.
   */
  private createAmbiguousIdentifierActions(
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const uris = diagnostic.relatedInformation.map(info => info.location.uri);
    return diagnostic.relatedInformation.map(item =>
      createFindIdentifierCommand(
        diagnostic,
        item.location.uri,
        this.defaultExtension,
        uris
      )
    );
  }

  /**
   * Creates the set of Quick Fixes for an `UNKNOWN_SECTION_CODE` diagnostic.
   * This generates one Code Action for each valid section in the target file.
   */
  private createUnknownSectionActions(
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const sectionIds = diagnostic.relatedInformation.map(info => info.message);
    return sectionIds
      .map(sectionId =>
        createReplaceSectionCommand(diagnostic, sectionId, this.workspace)
      )
      .filter((action): action is vscode.CodeAction => action !== null);
  }
}

/**
 * Creates a Code Action to fix a broken section link by replacing it with a valid one.
 * @param diagnostic The `UNKNOWN_SECTION_CODE` diagnostic.
 * @param sectionId The ID of a valid section to suggest as a replacement.
 * @param workspace The Foam workspace.
 * @returns A `vscode.CodeAction` or `null` if the target resource can't be found.
 */
const createReplaceSectionCommand = (
  diagnostic: vscode.Diagnostic,
  sectionId: string,
  workspace: FoamWorkspace
): vscode.CodeAction | null => {
  // Get the target resource from the diagnostic's related information
  const targetUri = fromVsCodeUri(
    diagnostic.relatedInformation[0].location.uri
  );
  const targetResource = workspace.get(targetUri);
  // Look up the section in the target resource by matching either heading ID or block ID.
  // The sectionId may be a heading's s.id or a block's s.blockId (including caret notation).
  const section = targetResource.sections.find(
    s => s.id === sectionId || s.blockId === sectionId
  );

  if (!section) {
    return null; // Should not happen if IDs are correctly passed
  }

  const getTitle = () => {
    switch (section.type) {
      case 'heading':
        return `Use heading "${section.label}"`;
      case 'block':
        return `Use block "${section.blockId}"`;
    }
  };

  const getReplacementValue = () => {
    switch (section.type) {
      case 'heading':
        return section.id;
      case 'block':
        return section.blockId; // Do not remove the '^' for insertion
    }
  };

  const action = new vscode.CodeAction(
    getTitle(),
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: REPLACE_TEXT_COMMAND.name,
    title: getTitle(),
    arguments: [
      {
        value: getReplacementValue(),
        range: new vscode.Range(
          diagnostic.range.start.line,
          diagnostic.range.start.character + 1,
          diagnostic.range.end.line,
          diagnostic.range.end.character - 2
        ),
      },
    ],
  };
  action.diagnostics = [diagnostic];
  return action;
};

/**
 * Creates a Code Action to fix an ambiguous link by replacing the link text
 * with an unambiguous identifier for the chosen file.
 * @param diagnostic The `AMBIGUOUS_IDENTIFIER_CODE` diagnostic.
 * @param target The URI of the specific file the user wants to link to.
 * @param defaultExtension The workspace's default file extension.
 * @param possibleTargets The list of all possible target URIs.
 * @returns A `vscode.CodeAction`.
 */
const createFindIdentifierCommand = (
  diagnostic: vscode.Diagnostic,
  target: vscode.Uri,
  defaultExtension: string,
  possibleTargets: vscode.Uri[]
): vscode.CodeAction => {
  const action = new vscode.CodeAction(
    `${vscode.workspace.asRelativePath(target)}`,
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: FIND_IDENTIFIER_COMMAND.name,
    title: 'Link to this resource',
    arguments: [
      {
        target: target,
        amongst: possibleTargets,
        defaultExtension: defaultExtension,
        range: new vscode.Range(
          diagnostic.range.start.line,
          diagnostic.range.start.character + 2,
          diagnostic.range.end.line,
          diagnostic.range.end.character - 2
        ),
      },
    ],
  };
  action.diagnostics = [diagnostic];
  return action;
};
