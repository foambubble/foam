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
 * The `filepath` of the built-in template: named after the title, in the
 * location new notes go to.
 */
const DEFAULT_NEW_NOTE_FILEPATH = '${FOAM_TITLE_SAFE}.md';

/**
 * The template used when none is loaded. Like any template with a
 * `filepath`, it creates a file — but a target the caller supplies
 * (placeholder link, `notePath`) wins, since the user did not write it.
 */
function builtInTemplate(hasTarget: boolean): Template {
  const frontmatter = hasTarget
    ? ''
    : `---\nfoam_template:\n  filepath: '${DEFAULT_NEW_NOTE_FILEPATH}'\n---\n`;
  return {
    type: 'markdown',
    content: frontmatter + DEFAULT_NEW_NOTE_TEXT,
    metadata: new Map(),
  };
}

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
  /**
   * Opens the note as an unsaved editor instead of writing a file. Providing
   * it declares the capability: a markdown template with no `filepath` and
   * no `fallbackFilepath` then opens unsaved (#1243). `uri`
   * is where saving it should go — named after the title when one is known,
   * and already resolved and checked like a file target — or `undefined`
   * when the user names it on save. Without the hook, a filename is derived
   * from the title as before. The built-in template declares a `filepath`,
   * so it always creates a file. `onDidCreate` does not run: nothing exists
   * until the user saves.
   */
  openUnsaved?: (content: string, uri: URI | undefined) => Promise<void>;
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
  | { status: 'cancelled' }
  /**
   * The note opened as an unsaved editor via `openUnsaved`; no file exists.
   * `uri` is where saving it goes, when a title named it.
   */
  | { status: 'opened-unsaved'; uri: URI | undefined };

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

  const template: Template =
    (await hooks.loadTemplate()) ??
    builtInTemplate(fallbackFilepath !== undefined);

  const result = await new NoteCreationEngine(foam).processTemplate(
    trigger,
    template,
    resolver,
    {
      defaultFilepath: fallbackFilepath,
      canOpenUnsaved: hooks.openUnsaved !== undefined,
    }
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

  // Resolves a candidate to a free, allowed, absolute target, or to the
  // outcome that stopped the search.
  const resolveTarget = async (
    candidate: URI
  ): Promise<{ target: URI } | { stopped: NoteCreationOutcome }> => {
    for (;;) {
      while (!candidate.isAbsolute()) {
        const next = await onRelativePath(candidate);
        if (next === undefined) {
          return { stopped: { status: 'cancelled' } };
        }
        candidate = next;
      }
      const target = resolveInWorkspace(candidate);
      if (!(await hooks.fileExists(target))) {
        return { target };
      }
      const next = await hooks.onFileExists(target);
      if (next === undefined) {
        return { stopped: { status: 'exists', uri: target } };
      }
      candidate = next;
    }
  };

  if ('unsaved' in result) {
    // The suggested path goes through the same checks as a file target: the
    // editor saves to it without asking, so it must be free and allowed.
    let uri: URI | undefined;
    if (result.suggestedFilepath) {
      const resolved = await resolveTarget(result.suggestedFilepath);
      if ('stopped' in resolved) {
        return resolved.stopped;
      }
      uri = resolved.target;
    }
    await hooks.openUnsaved(result.content, uri);
    return { status: 'opened-unsaved', uri };
  }

  const resolved = await resolveTarget(result.filepath);
  if ('stopped' in resolved) {
    return resolved.stopped;
  }
  const { target } = resolved;

  await hooks.writeNote(target, result.content);
  await hooks.onDidCreate?.(target);
  return { status: 'created', uri: target };
}
