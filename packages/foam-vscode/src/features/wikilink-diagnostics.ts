import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import {
  Block,
  Resource,
  ResourceLink,
  ResourceParser,
} from '../core/model/note';
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

const AMBIGUOUS_IDENTIFIER_CODE = 'ambiguous-identifier';
const UNKNOWN_SECTION_CODE = 'unknown-section';
const UNKNOWN_BLOCK_CODE = 'unknown-block';
const DUPLICATE_BLOCK_ID_CODE = 'duplicate-block-id';

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
      new IdentifierResolver(foam.workspace.defaultExtension),
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

export function updateDiagnostics(
  workspace: FoamWorkspace,
  parser: ResourceParser,
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  collection.clear();
  const result = [];
  if (document && document.languageId === 'markdown') {
    const resource = parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    for (const link of resource.links) {
      if (link.type === 'wikilink') {
        const { target, section, blockId } = MarkdownLink.analyzeLink(link);
        const targets = workspace.listByIdentifier(target);
        if (targets.length > 1) {
          result.push({
            code: AMBIGUOUS_IDENTIFIER_CODE,
            message: 'Resource identifier is ambiguous',
            range: toVsCodeRange(link.range),
            severity: vscode.DiagnosticSeverity.Warning,
            source: 'Foam',
            relatedInformation: targets.map(
              t =>
                new vscode.DiagnosticRelatedInformation(
                  new vscode.Location(
                    toVsCodeUri(t.uri),
                    new vscode.Position(0, 0)
                  ),
                  `Possible target: ${vscode.workspace.asRelativePath(
                    toVsCodeUri(t.uri)
                  )}`
                )
            ),
          });
        }
        if (section && targets.length === 1) {
          const resource = targets[0];
          if (isNone(Resource.findSection(resource, section))) {
            const range = getFragmentDiagnosticRange(link, section);
            result.push({
              code: UNKNOWN_SECTION_CODE,
              message: `Cannot find section "${section}" in document, available sections are:`,
              range: toVsCodeRange(range),
              severity: vscode.DiagnosticSeverity.Warning,
              source: 'Foam',
              relatedInformation: resource.sections.map(
                b =>
                  new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(
                      toVsCodeUri(resource.uri),
                      toVsCodePosition(b.range.start)
                    ),
                    b.label
                  )
              ),
            });
          }
        }
        if (blockId && targets.length === 1) {
          const resource = targets[0];
          if (isNone(Resource.findBlock(resource, blockId))) {
            const range = getFragmentDiagnosticRange(link, `^${blockId}`);
            result.push({
              code: UNKNOWN_BLOCK_CODE,
              message: `Cannot find block "^${blockId}" in document, available blocks are:`,
              range: toVsCodeRange(range),
              severity: vscode.DiagnosticSeverity.Warning,
              source: 'Foam',
              relatedInformation: resource.blocks.map(
                b =>
                  new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(
                      toVsCodeUri(resource.uri),
                      toVsCodePosition(b.range.start)
                    ),
                    `^${b.id}`
                  )
              ),
            });
          }
        }
      }
    }
    // Detect duplicate block IDs within this document
    const blocksByID = new Map<string, typeof resource.blocks>();
    for (const block of resource.blocks) {
      if (!blocksByID.has(block.id)) {
        blocksByID.set(block.id, []);
      }
      blocksByID.get(block.id)!.push(block);
    }
    for (const [id, blocks] of blocksByID) {
      if (blocks.length < 2) {
        continue;
      }
      // Only flag the duplicates (2nd occurrence onwards); the first is fine.
      for (const block of blocks.slice(1)) {
        const line = block.range.end.line;
        const lineText = document.lineAt(line).text;
        const anchorStart = lineText.lastIndexOf('^' + id);
        if (anchorStart < 0) {
          continue;
        }
        result.push({
          code: DUPLICATE_BLOCK_ID_CODE,
          message: `Duplicate block ID "^${id}" - ignored`,
          range: new vscode.Range(
            line,
            anchorStart,
            line,
            anchorStart + 1 + id.length
          ),
          severity: vscode.DiagnosticSeverity.Warning,
          source: 'Foam',
          relatedInformation: blocks
            .filter(b => b !== block)
            .map(
              b =>
                new vscode.DiagnosticRelatedInformation(
                  new vscode.Location(
                    document.uri,
                    new vscode.Position(b.range.end.line, 0)
                  ),
                  `Other occurrence of "^${id}"`
                )
            ),
        });
      }
    }

    if (result.length > 0) {
      collection.set(document.uri, result);
    }
  }
}

export class IdentifierResolver implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  constructor(private defaultExtension: string) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    return context.diagnostics.reduce((acc, diagnostic) => {
      if (diagnostic.code === AMBIGUOUS_IDENTIFIER_CODE) {
        const res: vscode.CodeAction[] = [];
        const uris = diagnostic.relatedInformation.map(
          info => info.location.uri
        );
        for (const item of diagnostic.relatedInformation) {
          res.push(
            createFindIdentifierCommand(
              diagnostic,
              item.location.uri,
              this.defaultExtension,
              uris
            )
          );
        }
        return [...acc, ...res];
      }
      if (diagnostic.code === UNKNOWN_SECTION_CODE) {
        const res: vscode.CodeAction[] = [];
        const sections = diagnostic.relatedInformation.map(
          info => info.message
        );
        for (const section of sections) {
          res.push(createReplaceSectionCommand(diagnostic, section));
        }
        return [...acc, ...res];
      }
      if (diagnostic.code === UNKNOWN_BLOCK_CODE) {
        const res: vscode.CodeAction[] = [];
        const blockIds = diagnostic.relatedInformation.map(
          info => info.message
        );
        for (const blockId of blockIds) {
          res.push(createReplaceBlockCommand(diagnostic, blockId));
        }
        return [...acc, ...res];
      }
      if (diagnostic.code === DUPLICATE_BLOCK_ID_CODE) {
        return [...acc, createReplaceBlockIdCommand(diagnostic)];
      }
      return acc;
    }, [] as vscode.CodeAction[]);
  }
}

const createReplaceSectionCommand = (
  diagnostic: vscode.Diagnostic,
  section: string
): vscode.CodeAction => {
  const action = new vscode.CodeAction(
    `${section}`,
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: REPLACE_TEXT_COMMAND.name,
    title: `Use section "${section}"`,
    arguments: [
      {
        value: section,
        range: fragmentValueRange(diagnostic.range),
      },
    ],
  };
  action.diagnostics = [diagnostic];
  return action;
};

const createReplaceBlockCommand = (
  diagnostic: vscode.Diagnostic,
  blockId: string
): vscode.CodeAction => {
  const action = new vscode.CodeAction(
    `${blockId}`,
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: REPLACE_TEXT_COMMAND.name,
    title: `Use block "${blockId}"`,
    arguments: [
      {
        value: blockId,
        range: fragmentValueRange(diagnostic.range),
      },
    ],
  };
  action.diagnostics = [diagnostic];
  return action;
};

/**
 * Returns the range covering `#fragment` in a wikilink. The range starts at
 * `#` and ends immediately after the fragment text, before any alias `|` or
 * closing `]]`. The caller supplies the already-parsed `fragment` string
 * (e.g. `"Section 1"` or `"^blockid"`), so no secondary rawText scanning is
 * needed.
 */
const getFragmentDiagnosticRange = (
  link: ResourceLink,
  fragment: string
): Range => {
  const hashPos = link.rawText.indexOf('#');
  if (hashPos < 0) {
    // No fragment — degenerate range at the link end
    return Range.create(
      link.range.end.line,
      link.range.end.character,
      link.range.end.line,
      link.range.end.character
    );
  }

  return Range.create(
    link.range.start.line,
    link.range.start.character + hashPos,
    link.range.end.line,
    link.range.start.character + hashPos + 1 + fragment.length
  );
};

/**
 * Given a diagnostic range that starts at `#` and ends just before `|` or
 * `]]` (as guaranteed by `getFragmentDiagnosticRange`), return the range
 * covering only the fragment value — i.e. everything after the `#`.
 */
const fragmentValueRange = (diagnosticRange: vscode.Range): vscode.Range =>
  new vscode.Range(
    diagnosticRange.start.line,
    diagnosticRange.start.character + 1,
    diagnosticRange.end.line,
    diagnosticRange.end.character
  );

const createReplaceBlockIdCommand = (
  diagnostic: vscode.Diagnostic
): vscode.CodeAction => {
  const newId = Block.generateId();
  const action = new vscode.CodeAction(
    'Replace with new ID',
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: REPLACE_TEXT_COMMAND.name,
    title: 'Replace with new ID',
    arguments: [
      {
        value: '^' + newId,
        range: diagnostic.range,
      },
    ],
  };
  action.diagnostics = [diagnostic];
  return action;
};

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
