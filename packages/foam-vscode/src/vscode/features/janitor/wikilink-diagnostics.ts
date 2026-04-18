import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam } from '../../../core/model/foam';
import { Block, ResourceParser } from '../../../core/model/note';
import { FoamWorkspace } from '../../../core/model/workspace';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
  lintIssueToDiagnostic,
} from '../../utils/vsc-utils';
import {
  AMBIGUOUS_IDENTIFIER_CODE,
  UNKNOWN_SECTION_CODE,
  UNKNOWN_BLOCK_CODE,
  DUPLICATE_BLOCK_ID_CODE,
  checkLinks,
  checkDuplicateBlocks,
} from '../../../janitor/rule-check-links';

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
  if (!document || document.languageId !== 'markdown') {
    return;
  }

  const resource = parser.parse(
    fromVsCodeUri(document.uri),
    document.getText()
  );

  const issues = [
    ...checkLinks(resource, workspace),
    ...checkDuplicateBlocks(resource),
  ];

  if (issues.length === 0) {
    return;
  }

  collection.set(document.uri, issues.map(lintIssueToDiagnostic));
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
        const uris = diagnostic.relatedInformation.map(
          info => info.location.uri
        );
        const res = diagnostic.relatedInformation.map(item =>
          createFindIdentifierCommand(
            diagnostic,
            item.location.uri,
            this.defaultExtension,
            uris
          )
        );
        return [...acc, ...res];
      }
      if (diagnostic.code === UNKNOWN_SECTION_CODE) {
        const res = diagnostic.relatedInformation.map(info =>
          createReplaceSectionCommand(diagnostic, info.message)
        );
        return [...acc, ...res];
      }
      if (diagnostic.code === UNKNOWN_BLOCK_CODE) {
        const res = diagnostic.relatedInformation.map(info =>
          createReplaceBlockCommand(diagnostic, info.message)
        );
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
 * Given a diagnostic range that starts at `#` and ends just before `|` or
 * `]]`, return the range covering only the fragment value (everything after `#`).
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
