import {
  getNewNoteTemplateCandidateUris,
  getTemplatesDir,
} from '../templates/template-discovery';
import { TemplateLoader } from '../templates/template-loader';
import { Resolver } from '../templates/variable-resolver';
import { NoteCreationEngine } from '../templates/note-creation-engine';
import { type Foam } from '../model/foam';
import { URI } from '../model/uri';
import { IDataStore } from '../services/datastore';
import { FoamError } from '../common/errors';
import { getBasename, isAbsolute, isWithinPath } from '../utils/path';

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
 * Creates a new note. If a `new-note.md` template exists in the workspace's
 * `.foam/templates/` directory, it is used to render the file; otherwise a
 * minimal `# title` body is written.
 *
 * The note is created under `opts.dir` if given (relative or absolute);
 * otherwise it goes under the first workspace root. In a multi-root
 * workspace the caller can pass an absolute `dir` to target a specific
 * root.
 *
 * `isTrusted` controls whether JavaScript templates (`new-note.js`) may
 * execute. Callers driven by untrusted input (MCP agents, CLI by default)
 * must pass `false`; the VS Code path passes `workspace.isTrusted`.
 *
 * Errors with `resource_exists` if the destination file already exists.
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
  // Resolve the target directory relative to the workspace root. Absolute
  // `dir` paths replace the root path; relative paths are joined. Either
  // form is then checked for containment: a `dir` that escapes the root
  // (absolute `/etc/cron.hourly`, relative `../../etc`) is rejected so
  // CLI/MCP callers can't use note creation as an arbitrary-write
  // primitive.
  const targetDirUri = opts.dir
    ? isAbsolute(opts.dir)
      ? rootUri.forPath(opts.dir)
      : rootUri.joinPath(opts.dir)
    : rootUri;
  if (!isWithinPath(targetDirUri, rootUri)) {
    throw new FoamError(
      'invalid_input',
      `dir is outside the workspace root: ${opts.dir}`,
      { dir: opts.dir }
    );
  }
  let targetUri = targetDirUri.joinPath(`${stem}.md`);

  const extraProps = opts.properties ?? {};
  const propLines = Object.entries(extraProps).map(([k, v]) => `${k}: ${v}`);
  const frontmatter =
    propLines.length > 0 ? `---\n${propLines.join('\n')}\n---\n\n` : '';
  let content = `${frontmatter}# ${title}\n`;

  // Try new-note.md / new-note.js template
  const templatesDir = getTemplatesDir(rootUri);
  const candidates = getNewNoteTemplateCandidateUris(templatesDir);

  let appliedTemplateFormat: 'md' | 'js' | undefined;
  for (const templateUri of candidates) {
    const templateContent = await dataStore.read(templateUri);
    if (templateContent === null) continue;

    const loader = new TemplateLoader(
      async uri => (await dataStore.read(uri)) ?? '',
      isTrusted
    );
    const template = await loader.loadTemplate(templateUri);
    const resolver = new Resolver(new Map(), new Date(), title);
    const engine = new NoteCreationEngine(foam);
    const result = await engine.processTemplate(
      { type: 'command', command: 'foam.create-note', params: { title } },
      template,
      resolver
    );

    targetUri = foam.workspace.resolveUri(result.filepath.path);
    content = result.content;
    appliedTemplateFormat = templateUri.path.endsWith('.js') ? 'js' : 'md';
    break;
  }

  // Re-check containment after template processing: a markdown template's
  // frontmatter `filepath:` could otherwise override the target with an
  // escaping path.
  if (!isWithinPath(targetUri, rootUri)) {
    throw new FoamError(
      'invalid_input',
      `Resolved target path is outside the workspace root: ${targetUri.path}`,
      { uri: targetUri.path }
    );
  }

  if (await dataStore.exists(targetUri)) {
    throw new FoamError(
      'resource_exists',
      `File already exists: ${targetUri.toFsPath()}`,
      { uri: targetUri.toFsPath() }
    );
  }

  await dataStore.write(targetUri, content);

  const id = getBasename(targetUri.path).replace(/\.md$/, '');
  return {
    id,
    uri: targetUri,
    ...(appliedTemplateFormat
      ? { templateType: 'default', templateFormat: appliedTemplateFormat }
      : {}),
  };
}
