import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { Resource, ResourceParser } from '../core/model/note';
import { Range } from '../core/model/range';
import { FoamWorkspace } from '../core/model/workspace';
import { MarkdownLink } from '../core/services/markdown-link';
import { FoamFeature } from '../types';
import { isNone } from '../utils';
import {
  fromVsCodeUri,
  toVsCodePosition,
  toVsCodeRange,
  toVsCodeUri,
} from '../utils/vsc-utils';

const AMBIGUOUS_IDENTIFIER_CODE = 'ambiguous-identifier';
const UNKNOWN_SECTION_CODE = 'unknown-section';

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
      let identifier = FoamWorkspace.getShortestIdentifier(
        target.path,
        amongst.map(uri => uri.path)
      );

      identifier = identifier.endsWith('.md')
        ? identifier.slice(0, -3)
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
      ),
      vscode.commands.registerCommand(
        REPLACE_TEXT_COMMAND.name,
        REPLACE_TEXT_COMMAND.execute
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
  const result = [];
  if (document && document.languageId === 'markdown') {
    const resource = parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    for (const link of resource.links) {
      if (link.type === 'wikilink') {
        const { target, section } = MarkdownLink.analyzeLink(link);
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
            const range = Range.create(
              link.range.start.line,
              link.range.start.character + target.length + 2,
              link.range.end.line,
              link.range.end.character
            );
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
            createFindIdentifierCommand(diagnostic, item.location.uri, uris)
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
      return acc;
    }, [] as vscode.CodeAction[]);
  }
}

const createReplaceSectionCommand = (
  diagnostic: vscode.Diagnostic,
  section: string
): vscode.CodeAction => {
  const action = new vscode.CodeAction(
    `Use ${section}`,
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: REPLACE_TEXT_COMMAND.name,
    title: `Use section ${section}`,
    arguments: [
      {
        value: section,
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

const createFindIdentifierCommand = (
  diagnostic: vscode.Diagnostic,
  target: vscode.Uri,
  possibleTargets: vscode.Uri[]
): vscode.CodeAction => {
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
};

export default feature;
