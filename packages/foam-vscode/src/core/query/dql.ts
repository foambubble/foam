import { parse as parseYaml } from 'yaml';
import { FoamWorkspace } from '../model/workspace';
import { FoamGraph } from '../model/graph';
import { QueryDescriptor, executeQuery } from '.';
import { escapeHtml, renderResults } from './html';

export function renderDqlQuery(
  content: string,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  trusted: boolean,
  toRelativePath: (path: string) => string
): string {
  let descriptor: QueryDescriptor;
  try {
    descriptor = (parseYaml(content) as QueryDescriptor) ?? {};
  } catch (e) {
    return `<div class="foam-query-error">YAML parse error: ${escapeHtml(
      String(e)
    )}</div>`;
  }

  // Ensure path is always fetched when title is selected so link generation
  // works in both list and table formats, even if the user didn't select path.
  const needsPath =
    descriptor.select &&
    descriptor.select.includes('title') &&
    !descriptor.select.includes('path');
  const execDescriptor: QueryDescriptor = needsPath
    ? { ...descriptor, select: [...descriptor.select, 'path'] }
    : descriptor;

  const results = executeQuery(execDescriptor, workspace, graph, { trusted });
  return renderResults(results, descriptor, toRelativePath);
}
