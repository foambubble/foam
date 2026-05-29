import { URI } from '../model/uri';

/**
 * Cycle-detection stack shared by the embed and foam-query plugins. Callers
 * `enter` before invoking a markdown renderer for a resource and `exit`
 * after; if the resource is already on the stack, `enter` returns false and
 * the caller emits a cycle warning instead of recursing.
 */
export interface RenderContext {
  /** Returns false (without pushing) if `uri` is already on the stack. */
  enter(uri: URI): boolean;
  exit(uri: URI): void;
  has(uri: URI): boolean;
  /** Snapshot of the stack, deepest first. */
  current(): URI[];
}

export function createRenderContext(): RenderContext {
  const stack: URI[] = [];
  const indexOf = (uri: URI): number =>
    stack.findIndex(u => u.isEqual(uri));
  return {
    enter(uri: URI): boolean {
      if (indexOf(uri) !== -1) return false;
      stack.push(uri);
      return true;
    },
    exit(uri: URI): void {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].isEqual(uri)) {
          stack.splice(i, 1);
          return;
        }
      }
    },
    has(uri: URI): boolean {
      return indexOf(uri) !== -1;
    },
    current(): URI[] {
      return [...stack];
    },
  };
}
