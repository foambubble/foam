import { URI } from '../core/model/uri';
import { existsSync } from 'fs';
import * as path from 'path';
import { isAbsolute } from 'path';
import { TextEncoder } from 'util';
import { SnippetString, ViewColumn, window, workspace } from 'vscode';
import { focusNote } from '../utils';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { UserCancelledOperation } from './errors';
import {
  createDocAndFocus,
  findSelectionContent,
  getCurrentEditorDirectory,
  replaceSelection,
} from './editor';
import { Resolver } from './variable-resolver';

/**
 * The templates directory
 */
export const TEMPLATES_DIR = URI.joinPath(
  fromVsCodeUri(workspace.workspaceFolders[0].uri),
  '.foam',
  'templates'
);

/**
 * The URI of the default template
 */
export const DEFAULT_TEMPLATE_URI = URI.joinPath(TEMPLATES_DIR, 'new-note.md');

/**
 * The URI of the template for daily notes
 */
export const DAILY_NOTE_TEMPLATE_URI = URI.joinPath(
  TEMPLATES_DIR,
  'daily-note.md'
);

const WIKILINK_DEFAULT_TEMPLATE_TEXT = `# $\{1:$FOAM_TITLE}\n\n$0`;

const TEMPLATE_CONTENT = `# \${1:$TM_FILENAME_BASE}

Welcome to Foam templates.

What you see in the heading is a placeholder
- it allows you to quickly move through positions of the new note by pressing TAB, e.g. to easily fill fields
- a placeholder optionally has a default value, which can be some text or, as in this case, a [variable](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_variables)
  - when landing on a placeholder, the default value is already selected so you can easily replace it
- a placeholder can define a list of values, e.g.: \${2|one,two,three|}
- you can use variables even outside of placeholders, here is today's date: \${CURRENT_YEAR}/\${CURRENT_MONTH}/\${CURRENT_DATE}

For a full list of features see [the VS Code snippets page](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax).

## To get started

1. edit this file to create the shape new notes from this template will look like
2. create a note from this template by running the \`Foam: Create New Note From Template\` command
`;

export async function getTemplateMetadata(
  templateUri: URI
): Promise<Map<string, string>> {
  const contents = await workspace.fs
    .readFile(toVsCodeUri(templateUri))
    .then(bytes => bytes.toString());
  const [templateMetadata] = extractFoamTemplateFrontmatterMetadata(contents);
  return templateMetadata;
}

export async function getTemplates(): Promise<URI[]> {
  const templates = await workspace
    .findFiles('.foam/templates/**.md', null)
    .then(v => v.map(uri => fromVsCodeUri(uri)));
  return templates;
}

export const NoteFactory = {
  /**
   * Creates a new note using a template.
   * @param givenValues already resolved values of Foam template variables. These are used instead of resolving the Foam template variables.
   * @param extraVariablesToResolve Foam template variables to resolve, in addition to those mentioned in the template.
   * @param templateUri the URI of the template to use.
   * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
   * @param templateFallbackText the template text to use if the template does not exist. This is configurable by the caller for backwards compatibility purposes.
   */
  createFromTemplate: async (
    templateUri: URI,
    resolver: Resolver,
    filepathFallbackURI?: URI,
    templateFallbackText: string = ''
  ): Promise<void> => {
    const templateText = existsSync(URI.toFsPath(templateUri))
      ? await workspace.fs
          .readFile(toVsCodeUri(templateUri))
          .then(bytes => bytes.toString())
      : templateFallbackText;

    const selectedContent = findSelectionContent();

    resolver.define('FOAM_SELECTED_TEXT', selectedContent?.content ?? '');
    let resolvedValues: Map<string, string>,
      templateWithResolvedVariables: string;
    try {
      [
        resolvedValues,
        templateWithResolvedVariables,
      ] = await resolver.resolveText(templateText);
    } catch (err) {
      if (err instanceof UserCancelledOperation) {
        return;
      }
      throw err;
    }

    const [
      templateMetadata,
      templateWithFoamFrontmatterRemoved,
    ] = extractFoamTemplateFrontmatterMetadata(templateWithResolvedVariables);
    const templateSnippet = new SnippetString(
      templateWithFoamFrontmatterRemoved
    );

    let filepath = await determineNewNoteFilepath(
      templateMetadata.get('filename'),
      filepathFallbackURI,
      resolver
    );

    if (existsSync(URI.toFsPath(filepath))) {
      const filename = path.basename(filepath.path);
      const newFilepath = await askUserForFilepathConfirmation(
        filepath,
        filename
      );

      if (newFilepath === undefined) {
        return;
      }
      filepath = URI.file(newFilepath);
    }

    await createDocAndFocus(
      templateSnippet,
      filepath,
      selectedContent ? ViewColumn.Beside : ViewColumn.Active
    );

    if (selectedContent !== undefined) {
      const newNoteTitle = URI.getFileNameWithoutExtension(filepath);

      await replaceSelection(
        selectedContent.document,
        selectedContent.selection,
        `[[${newNoteTitle}]]`
      );
    }
  },

  /**
   * Creates a daily note from the daily note template.
   * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
   * @param templateFallbackText the template text to use if daily-note.md template does not exist. This is configurable by the caller for backwards compatibility purposes.
   */
  createFromDailyNoteTemplate: (
    filepathFallbackURI: URI,
    templateFallbackText: string,
    targetDate: Date
  ): Promise<void> => {
    const resolver = new Resolver(
      new Map(),
      targetDate,
      new Set(['FOAM_SELECTED_TEXT'])
    );
    return NoteFactory.createFromTemplate(
      DAILY_NOTE_TEMPLATE_URI,
      resolver,
      filepathFallbackURI,
      templateFallbackText
    );
  },

  /**
   * Creates a new note when following a placeholder wikilink using the default template.
   * @param wikilinkPlaceholder the placeholder value from the wikilink. (eg. `[[Hello Joe]]` -> `Hello Joe`)
   * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
   */
  createForPlaceholderWikilink: (
    wikilinkPlaceholder: string,
    filepathFallbackURI: URI
  ): Promise<void> => {
    const resolver = new Resolver(
      new Map().set('FOAM_TITLE', wikilinkPlaceholder),
      new Date(),
      new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT'])
    );
    return NoteFactory.createFromTemplate(
      DEFAULT_TEMPLATE_URI,
      resolver,
      filepathFallbackURI,
      WIKILINK_DEFAULT_TEMPLATE_TEXT
    );
  },
};

export const createTemplate = async (): Promise<void> => {
  const defaultFilename = 'new-template.md';
  const defaultTemplate = URI.joinPath(TEMPLATES_DIR, defaultFilename);
  const fsPath = URI.toFsPath(defaultTemplate);
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new template`,
    value: fsPath,
    valueSelection: [fsPath.length - defaultFilename.length, fsPath.length - 3],
    validateInput: value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : existsSync(value)
        ? 'File already exists'
        : undefined,
  });
  if (filename === undefined) {
    return;
  }

  const filenameURI = URI.file(filename);
  await workspace.fs.writeFile(
    toVsCodeUri(filenameURI),
    new TextEncoder().encode(TEMPLATE_CONTENT)
  );
  await focusNote(filenameURI, false);
};

async function askUserForFilepathConfirmation(
  defaultFilepath: URI,
  defaultFilename: string
) {
  const fsPath = URI.toFsPath(defaultFilepath);
  return await window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: fsPath,
    valueSelection: [fsPath.length - defaultFilename.length, fsPath.length - 3],
    validateInput: value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : existsSync(value)
        ? 'File already exists'
        : undefined,
  });
}

export async function determineNewNoteFilepath(
  templateFilepathAttribute: string | undefined,
  fallbackURI: URI | undefined,
  resolver: Resolver
): Promise<URI> {
  if (templateFilepathAttribute) {
    const defaultFilepath = isAbsolute(templateFilepathAttribute)
      ? URI.file(templateFilepathAttribute)
      : URI.joinPath(
          fromVsCodeUri(workspace.workspaceFolders[0].uri),
          templateFilepathAttribute
        );
    return defaultFilepath;
  }

  if (fallbackURI) {
    return fallbackURI;
  }

  const defaultName = await resolver.resolve('FOAM_TITLE');
  const defaultFilepath = URI.joinPath(
    getCurrentEditorDirectory(),
    `${defaultName}.md`
  );
  return defaultFilepath;
}
