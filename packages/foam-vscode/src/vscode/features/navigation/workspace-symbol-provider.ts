import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { FoamWorkspace, isSubsequence } from '@foam/core';
import { toVsCodeRange, toVsCodeUri } from '../../utils/vsc-utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const workspaceSymbolProvider = new FoamWorkspaceSymbolProvider(
    foam.workspace
  );

  context.subscriptions.push(
    vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider)
  );
}

/**
 * Provides workspace symbols for note aliases.
 * Allows users to search for notes by their aliases using "Go To Symbol in Workspace" (Ctrl+T/Cmd+T).
 */
export class FoamWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider
{
  constructor(private workspace: FoamWorkspace) {}

  /**
   * Provide workspace symbols for note aliases.
   * Called every time the user types in the symbol search box.
   */
  provideWorkspaceSymbols(query: string): vscode.SymbolInformation[] {
    return this.workspace
      .list()
      .flatMap(resource =>
        resource.aliases
          .filter(alias =>
            isSubsequence(query.toLowerCase(), alias.title.toLowerCase())
          )
          .map(
            alias =>
              new vscode.SymbolInformation(
                alias.title,
                vscode.SymbolKind.String,
                resource.uri.getBasename(),
                new vscode.Location(
                  toVsCodeUri(resource.uri),
                  toVsCodeRange(alias.range)
                )
              )
          )
      );
  }
}
