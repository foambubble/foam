import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { ResourceParser } from '../core/model/note';
import { FoamWorkspace } from '../core/model/workspace';
import { getShortestIdentifier } from '../core/utils';
import { FoamFeature } from '../types';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';

const AMBIGUOUS_IDENTIFIER_CODE = 'ambiguous-identifier';

interface FoamCommand<T> {
  name: string;
  execute: (params: T) => Promise<void>;
}

interface FindIdentifierCommandArgs {
  range: vscode.Range;
  target: vscode.Uri;
  amongst: vscode.Uri[];
}

const FIND_IDENTIFER_COMMAND: FoamCommand<FindIdentifierCommandArgs> = {
  name: 'foam:compute-identifier',
  execute: async ({ target, amongst, range }) => {
    if (vscode.window.activeTextEditor) {
      let identifier = getShortestIdentifier(
        target.path,
        amongst.map(uri => uri.path)
      );

      identifier = identifier.endsWith('.md')
        ? identifier.slice(0, -3)
        : identifier;

      vscode.window.activeTextEditor.edit(builder => {
        builder.replace(range, identifier);
      });
    }
  },
};

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
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
        new IdentifierResolver(),
        {
          providedCodeActionKinds: IdentifierResolver.providedCodeActionKinds,
        }
      ),
      vscode.commands.registerCommand(
        FIND_IDENTIFER_COMMAND.name,
        FIND_IDENTIFER_COMMAND.execute
      )
    );
  },
};

export function updateDiagnostics(
  workspace: FoamWorkspace,
  parser: ResourceParser,
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  collection.clear();
  if (document && document.languageId === 'markdown') {
    const resource = parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    for (const link of resource.links) {
      if (link.type === 'wikilink') {
        const targets = workspace.listById(link.target);
        if (targets.length > 1) {
          collection.set(document.uri, [
            {
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
            },
          ]);
        }
      }
    }
  }
}

export class IdentifierResolver implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    return context.diagnostics
      .filter(diagnostic => diagnostic.code === AMBIGUOUS_IDENTIFIER_CODE)
      .reduce((acc, diagnostic) => {
        const res: vscode.CodeAction[] = [];
        const uris = diagnostic.relatedInformation.map(
          info => info.location.uri
        );
        for (const item of diagnostic.relatedInformation) {
          res.push(
            this.createCommandCodeAction(diagnostic, item.location.uri, uris)
          );
        }
        return [...acc, ...res];
      }, [] as vscode.CodeAction[]);
  }

  private createCommandCodeAction(
    diagnostic: vscode.Diagnostic,
    target: vscode.Uri,
    possibleTargets: vscode.Uri[]
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Use ${vscode.workspace.asRelativePath(target)}`,
      vscode.CodeActionKind.QuickFix
    );
    action.command = {
      command: FIND_IDENTIFER_COMMAND.name,
      title: 'Link to this resource',
      arguments: [
        {
          target: target,
          amongst: possibleTargets,
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
  }
}

export default feature;
