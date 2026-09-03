import { FoamError } from '../common/errors';
import { Foam } from '../model/foam';
import { URI, asAbsoluteUri } from '../model/uri';
import { NoteCreationEngine } from '../templates/note-creation-engine';
import {
  NoteCreationTrigger,
  Template,
} from '../templates/note-creation-types';
import { Resolver } from '../templates/variable-resolver';
import { isWithinPath } from '../utils/path';

/**
 * Content of a note created without a template: a title heading followed by
 * the text selected when the note was created (empty outside an editor).
 */
export const DEFAULT_NEW_NOTE_TEXT = '# ${FOAM_TITLE}\n\n${FOAM_SELECTED_TEXT}';

/**
 * Client-specific behavior injected into {@link createNote}.
 */
export interface NoteCreationHooks {
  /**
   * Selects and loads the template (quick-pick, `new-note.*` discovery,
   * daily-note template...). Return `undefined` to use
   * {@link DEFAULT_NEW_NOTE_TEXT}.
   */
  loadTemplate: () => Promise<Template | undefined>;
  fileExists: (uri: URI) => Promise<boolean>;
  /**
   * Called when a file already exists at the target. Return a new target
   * to retry with (it goes through the same checks), or `undefined` to stop
   * with an `exists` outcome. Deleting the file for an overwrite belongs
   * here.
   */
  onFileExists: (uri: URI) => Promise<URI | undefined>;
  /**
   * Called when the target is relative. Return an absolute target, or
   * `undefined` to stop with a `cancelled` outcome. Defaults to resolving
   * against the workspace roots.
   */
  onRelativePath?: (uri: URI) => Promise<URI | undefined>;
  /** The write itself: datastore write, or open an editor with a snippet. */
  writeNote: (uri: URI, content: string) => Promise<void>;
  /** Runs once the note is written, e.g. to link the source selection to it. */
  onDidCreate?: (uri: URI) => Promise<void>;
}

export interface NoteCreationRequest {
  foam: Foam;
  trigger: NoteCreationTrigger;
  /** Resolver with all variables pre-configured (title, date, selection...). */
  resolver: Resolver;
  /**
   * Target to use when the template (markdown or the default text) does not
   * define a `filepath`. Goes through the same resolution and checks as a
   * template-derived target: a relative URI is passed to `onRelativePath`,
   * an absolute one is used as is. Ignored for JavaScript templates, which
   * must return their own.
   */
  fallbackFilepath?: URI;
  /**
   * Whether the note may be created outside the workspace roots. VS Code
   * passes workspace trust; non-interactive clients (CLI, MCP) leave it
   * unset so containment is always enforced.
   */
  isTrusted?: boolean;
}

export type NoteCreationOutcome =
  | { status: 'created'; uri: URI }
  /** A file exists at `uri` and `onFileExists` chose to stop. */
  | { status: 'exists'; uri: URI }
  /** `onRelativePath` chose to stop; nothing was written. */
  | { status: 'cancelled' };

/**
 * Whether a note may be created at `target`.
 *
 * In an untrusted workspace the note must land inside one of the workspace
 * roots. Templates are workspace content like any other, and a `filepath`
 * that escapes the root (e.g. `../../.zshrc`) would turn note creation into
 * an arbitrary-write primitive without the user ever opting in.
 *
 * Trusting the workspace lifts the restriction: templates are then the user's
 * own, and filing a note into a sibling directory is a legitimate thing to
 * want. Workspace trust is the deliberate, persistent opt-in VS Code already
 * provides, which is why there's no per-note prompt here. The CLI and MCP
 * are non-interactive, so there is no trust to grant and the restriction
 * always applies.
 */
export function isNoteTargetAllowed(
  target: URI,
  roots: URI[],
  isTrusted: boolean
): boolean {
  return isTrusted || roots.some(root => isWithinPath(target, root));
}

/**
 * Creates a note: template (or default text) → single resolution pass →
 * target resolution with collision handling → write.
 *
 * Expected situations (target exists, user cancelled) are reported through
 * the outcome. A target outside the workspace throws
 * `FoamError('invalid_input')`; template loading and execution errors
 * propagate as they are.
 */
export async function createNote(
  request: NoteCreationRequest,
  hooks: NoteCreationHooks
): Promise<NoteCreationOutcome> {
  const { foam, trigger, resolver, fallbackFilepath } = request;
  const isTrusted = request.isTrusted ?? false;
  const roots = foam.workspace.roots;

  const template: Template = (await hooks.loadTemplate()) ?? {
    type: 'markdown',
    content: DEFAULT_NEW_NOTE_TEXT,
    metadata: new Map(),
  };

  const result = await new NoteCreationEngine(foam).processTemplate(
    trigger,
    template,
    resolver,
    { defaultFilepath: fallbackFilepath }
  );

  const onRelativePath =
    hooks.onRelativePath ?? (async (uri: URI) => asAbsoluteUri(uri, roots));

  // Every candidate is checked as soon as it resolves, not just the final
  // one: `onFileExists` may delete the existing file (overwrite), so a check
  // placed only before the write would let an escaping path destroy a file
  // outside the workspace first. Templates can also set the target, which is
  // why the check happens after template processing rather than on the input.
  const resolveInWorkspace = (uri: URI): URI => {
    const resolved = asAbsoluteUri(uri, roots);
    if (!isNoteTargetAllowed(resolved, roots, isTrusted)) {
      throw new FoamError(
        'invalid_input',
        `Cannot create a note outside the workspace: ${resolved.toFsPath()}`,
        { uri: resolved.toFsPath() }
      );
    }
    return resolved;
  };

  let candidate = result.filepath;
  let target: URI;
  for (;;) {
    while (!candidate.isAbsolute()) {
      const next = await onRelativePath(candidate);
      if (next === undefined) {
        return { status: 'cancelled' };
      }
      candidate = next;
    }
    target = resolveInWorkspace(candidate);
    if (!(await hooks.fileExists(target))) {
      break;
    }
    const next = await hooks.onFileExists(target);
    if (next === undefined) {
      return { status: 'exists', uri: target };
    }
    candidate = next;
  }

  await hooks.writeNote(target, result.content);
  await hooks.onDidCreate?.(target);
  return { status: 'created', uri: target };
}
