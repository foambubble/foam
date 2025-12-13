import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace/foamWorkspace';
import { toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';

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
          .filter(
            alias => query === '' || this.matchesQuery(query, alias.title)
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

  /**
   * Check if a candidate string matches a query using subsequence matching.
   * Characters of query must appear in their order in the candidate (case-insensitive).
   * This follows VS Code's recommended approach for symbol providers.
   *
   * Examples:
   * - "alt" matches "alternative title"
   * - "altit" matches "alternative title"
   * - "title alt" does not match "alternative title" (wrong order)
   */
  matchesQuery(query: string, candidate: string): boolean {
    const queryLower = query.toLowerCase();
    const candidateLower = candidate.toLowerCase();

    let queryIndex = 0;
    for (
      let i = 0;
      i < candidateLower.length && queryIndex < queryLower.length;
      i++
    ) {
      if (candidateLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === queryLower.length;
  }
}
