import { URI } from '../src/model/uri';
import { createMarkdownParser } from '../src/services/markdown-parser';

/** The part of a markdown tree node (mdast, remark-parse 8) read here. */
interface Node {
  type: string;
  checked?: boolean | null;
  children?: Node[];
  position?: { start: { line: number } };
}

let lastTree: Node | null = null;
const parser = createMarkdownParser([
  {
    name: 'task-tree',
    onDidVisitTree: tree => {
      lastTree = tree as Node;
    },
  },
]);

/**
 * The task lines of `content` as core's parser reads it: list items with a
 * checkbox and something after it on the same line, as `[line, done]`, line
 * from 0, in order.
 */
export function parserTasks(content: string): [number, boolean][] {
  parser.parse(URI.file('/note.md'), content);
  const tasks: [number, boolean][] = [];
  const visit = (node: Node) => {
    const line = node.position!.start.line;
    if (
      node.type === 'listItem' &&
      typeof node.checked === 'boolean' &&
      node.children?.[0]?.position?.start.line === line
    ) {
      tasks.push([line - 1, node.checked]);
    }
    node.children?.forEach(visit);
  };
  visit(lastTree!);
  return tasks.sort((a, b) => a[0] - b[0]);
}
