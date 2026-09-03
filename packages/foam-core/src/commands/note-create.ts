import {
  getNewNoteTemplateCandidateUris,
  getTemplatesDir,
} from '../templates/template-discovery';
import { TemplateLoader } from '../templates/template-loader';
import { Resolver } from '../templates/variable-resolver';
import { type Foam } from '../model/foam';
import { URI } from '../model/uri';
import { IDataStore } from '../services/datastore';
import { NoteCreationHooks, createNote } from '../services/note-creation-flow';
import { FoamError } from '../common/errors';
import { getBasename, isAbsolute } from '../utils/path';

export interface NoteCreateResult {
  id: string;
  uri: URI;
  /**
   * Which template family produced the note's content. Omitted when no
   * template was applied (the note got the minimal `# title` fallback body).
   *
   * - `default`: `new-note.md` or `new-note.js` from `.foam/templates/` was used.
   * - `daily-note`: `daily-note.md` or `daily-note.js` from `.foam/templates/`
   *   was used (only emitted by `daily --create`, not `note create`).
   * - `custom`: reserved for future flows where the caller picks a named
   *   template; the current `note create` API does not take a template name.
   */
  templateType?: 'default' | 'daily-note' | 'custom';
  /**
   * The format of the applied template. Omitted whenever `templateType`
   * is omitted (the two travel together).
   */
  templateFormat?: 'md' | 'js';
}

/**
 * Creates a new note. If a `new-note.md` / `new-note.js` template exists in
 * the workspace's `.foam/templates/` directory, it is used to render the
 * file; otherwise a minimal `# title` body is written.
 *
 * The note is created under `opts.dir` if given (relative or absolute);
 * otherwise it goes under the first workspace root. In a multi-root
 * workspace the caller can pass an absolute `dir` to target a specific
 * root. A template that sets its own `filepath` takes precedence.
 *
 * `isTrusted` controls whether JavaScript templates (`new-note.js`) may
 * execute. Callers driven by untrusted input (MCP agents, CLI by default)
 * must pass `false`; the VS Code path passes `workspace.isTrusted`.
 *
 * Errors with `invalid_input` if the target — from `dir` or from the
 * template — lands outside the workspace root, so CLI/MCP callers can't use
 * note creation as an arbitrary-write primitive. Errors with
 * `resource_exists` if the destination file already exists.
 */
export async function noteCreate(
  foam: Foam,
  dataStore: IDataStore,
  opts: {
    title?: string;
    dir?: string;
    properties?: Record<string, string>;
  },
  isTrusted: boolean
): Promise<NoteCreateResult> {
  const title = opts.title ?? 'untitled';
  const rootUri = foam.workspace.roots[0];

  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const targetDirUri = opts.dir
    ? isAbsolute(opts.dir)
      ? rootUri.forPath(opts.dir)
      : rootUri.joinPath(opts.dir)
    : rootUri;

  const propLines = Object.entries(opts.properties ?? {}).map(
    ([k, v]) => `${k}: ${v}`
  );
  const frontmatter =
    propLines.length > 0 ? `---\n${propLines.join('\n')}\n---\n\n` : '';

  let appliedTemplateFormat: 'md' | 'js' | undefined;
  const hooks: NoteCreationHooks = {
    loadTemplate: async () => {
      const templatesDir = getTemplatesDir(rootUri);
      for (const templateUri of getNewNoteTemplateCandidateUris(templatesDir)) {
        if (!(await dataStore.exists(templateUri))) continue;
        const loader = new TemplateLoader(
          async uri => (await dataStore.read(uri)) ?? '',
          isTrusted
        );
        const template = await loader.loadTemplate(templateUri);
        appliedTemplateFormat = templateUri.path.endsWith('.js') ? 'js' : 'md';
        return template;
      }
      return undefined;
    },
    fileExists: uri => dataStore.exists(uri),
    onFileExists: async () => undefined,
    // `properties` become frontmatter of the fallback body only: a template
    // owns its content, frontmatter included.
    writeNote: (uri, content) =>
      dataStore.write(
        uri,
        appliedTemplateFormat ? content : frontmatter + content
      ),
  };

  const outcome = await createNote(
    {
      foam,
      trigger: {
        type: 'command',
        command: 'foam.create-note',
        params: { title },
      },
      resolver: new Resolver(new Map(), new Date(), title),
      fallbackFilepath: targetDirUri.joinPath(`${stem}.md`),
    },
    hooks
  );

  if (outcome.status === 'exists') {
    throw new FoamError(
      'resource_exists',
      `File already exists: ${outcome.uri.toFsPath()}`,
      { uri: outcome.uri.toFsPath() }
    );
  }
  if (outcome.status === 'cancelled') {
    // Unreachable: relative targets resolve against the root, never cancel.
    throw new FoamError('io_error', 'Note creation was cancelled');
  }

  const id = getBasename(outcome.uri.path).replace(/\.md$/, '');
  return {
    id,
    uri: outcome.uri,
    ...(appliedTemplateFormat
      ? { templateType: 'default', templateFormat: appliedTemplateFormat }
      : {}),
  };
}
