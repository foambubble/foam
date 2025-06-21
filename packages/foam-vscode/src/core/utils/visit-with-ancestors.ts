import { Node } from 'unist';
import visit from 'unist-util-visit';

/**
 * A shim function that replicates the behavior of unist-util-visit-parents
 * by manually tracking ancestors and providing them to the visitor function.
 *
 * This allows existing parsing logic that expects the `ancestors` array
 * to function correctly with `unist-util-visit`.
 *
 * @param tree The root of the AST to traverse.
 * @param visitor The function to call for each node, with signature (node, ancestors).
 *                It can return `visit.SKIP` (symbol) or the string 'skip' to stop traversing children.
 */
export function visitWithAncestors(
  tree: Node,
  visitor: (node: Node, ancestors: Node[]) => void | symbol | 'skip'
) {
  const ancestors: Node[] = [];

  visit(tree, (node, index, parent) => {
    // Maintain the ancestors stack
    // When we visit a node, its parent is the last element added to the stack.
    // If the current node is not a child of the last ancestor, it means we've
    // moved to a sibling or a new branch, so we need to pop ancestors until
    // the current parent is at the top of the stack.
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== parent) {
      ancestors.pop();
    }

    // Add the current node's parent to the ancestors stack if it's not already there
    if (parent && ancestors[ancestors.length - 1] !== parent) {
      ancestors.push(parent);
    }

    // Call the original visitor with the node and the current ancestors stack
    const result = visitor(node, [...ancestors]); // Pass a copy to prevent external modification

    // If the visitor returns visit.SKIP (symbol) or 'skip' (string), propagate it to unist-util-visit
    if (
      result === visit.SKIP ||
      (typeof result === 'string' && result === 'skip')
    ) {
      return visit.SKIP;
    }

    // Push the current node onto the stack for its children
    ancestors.push(node);
  });
}
