import { URI } from '../core/model/uri';
import { TextEncoder } from 'util';
import {
  FileType,
  SnippetString,
  ViewColumn,
  QuickPickItem,
  commands,
  window,
  workspace,
} from 'vscode';
import { focusNote } from '../utils';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { UserCancelledOperation } from './errors';
import {
  asAbsoluteWorkspaceUri,
  createDocAndFocus,
  deleteFile,
  fileExists,
  findSelectionContent,
  getCurrentEditorDirectory,
  readFile,
  replaceSelection,
} from './editor';
import { Resolver } from './variable-resolver';
import dateFormat from 'dateformat';
import '../features/commands/create-note-from-template';

/**
 * The templates directory
 */
export const getTemplatesDir = () =>
  fromVsCodeUri(workspace.workspaceFolders[0].uri).joinPath(
    '.foam',
    'templates'
  );

/**
 * The URI of the default template
 */
export const getDefaultTemplateUri = () =>
  getTemplatesDir().joinPath('new-note.md');

/**
 * The URI of the template for daily notes
 */
export const getDailyNoteTemplateUri = () =>
  getTemplatesDir().joinPath('daily-note.md');

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
  const contents = (await readFile(templateUri)) ?? '';
  const [templateMetadata] = extractFoamTemplateFrontmatterMetadata(contents);
  return templateMetadata;
}

export async function getTemplates(): Promise<URI[]> {
  const templates = await workspace
    .findFiles('.foam/templates/**.md', null)
    .then(v => v.map(uri => fromVsCodeUri(uri)));
  return templates;
}

export async function getTemplateInfo(
  templateUri: URI,
  templateFallbackText = '',
  resolver: Resolver
) {
  const templateText = (await readFile(templateUri)) ?? templateFallbackText;

  const templateWithResolvedVariables = await resolver.resolveText(
    templateText
  );

  const [
    templateMetadata,
    templateWithFoamFrontmatterRemoved,
  ] = extractFoamTemplateFrontmatterMetadata(templateWithResolvedVariables);

  return {
    metadata: templateMetadata,
    text: templateWithFoamFrontmatterRemoved,
  };
}

export type OnFileExistStrategy =
  | 'open'
  | 'overwrite'
  | 'cancel'
  | 'ask'
  | ((filePath: URI) => Promise<URI | undefined>);
  
async function askUserForTemplate() {
  const templates = await getTemplates();
  if (templates.length === 0) {
    return offerToCreateTemplate();
  }

  const templatesMetadata = (
    await Promise.all(
      templates.map(async templateUri => {
        const metadata = await getTemplateMetadata(templateUri);
        metadata.set('templatePath', templateUri.getBasename());
        return metadata;
      })
    )
  ).sort(sortTemplatesMetadata);

  const items: QuickPickItem[] = await Promise.all(
    templatesMetadata.map(metadata => {
      const label = metadata.get('name') || metadata.get('templatePath');
      const description = metadata.get('name')
        ? metadata.get('templatePath')
        : null;
      const detail = metadata.get('description');
      const item = {
        label: label,
        description: description,
        detail: detail,
      };
      Object.keys(item).forEach(key => {
        if (!item[key]) {
          delete item[key];
        }
      });
      return item;
    })
  );

  return await window.showQuickPick(items, {
    placeHolder: 'Select a template to use.',
  });
}

async function offerToCreateTemplate(): Promise<void> {
  const response = await window.showQuickPick(['Yes', 'No'], {
    placeHolder:
      'No templates available. Would you like to create one instead?',
  });
  if (response === 'Yes') {
    commands.executeCommand('foam-vscode.create-new-template');
    return;
  }
}

function sortTemplatesMetadata(
  t1: Map<string, string>,
  t2: Map<string, string>
) {
  // Sort by name's existence, then name, then path

  if (t1.get('name') === undefined && t2.get('name') !== undefined) {
    return 1;
  }

  if (t1.get('name') !== undefined && t2.get('name') === undefined) {
    return -1;
  }

  const pathSortOrder = t1
    .get('templatePath')
    .localeCompare(t2.get('templatePath'));

  if (t1.get('name') === undefined && t2.get('name') === undefined) {
    return pathSortOrder;
  }

  const nameSortOrder = t1.get('name').localeCompare(t2.get('name'));

  return nameSortOrder || pathSortOrder;
}

export const NoteFactory = {
  createNote: async (
    newFilePath: URI,
    text: string,
    resolver: Resolver,
    onFileExists?: OnFileExistStrategy,
    replaceSelectionWithLink = true
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    try {
      const onFileExistsFn = async (existingFile: URI) => {
        if (typeof onFileExists === 'function') {
          return onFileExists(existingFile);
        }
        switch (onFileExists) {
          case 'open':
            await commands.executeCommand(
              'vscode.open',
              toVsCodeUri(existingFile)
            );
            return;
          case 'overwrite':
            await deleteFile(existingFile);
            return existingFile;
          case 'cancel':
            return undefined;
          case 'ask':
          default: {
            const newProposedPath = await askUserForFilepathConfirmation(
              existingFile
            );
            return newProposedPath && URI.file(newProposedPath);
          }
        }
      };

      while (await fileExists(newFilePath)) {
        const proposedNewFilepath = await onFileExistsFn(newFilePath);

        if (proposedNewFilepath === undefined) {
          return { didCreateFile: false, uri: newFilePath };
        }
        newFilePath = proposedNewFilepath;
      }

      const expandedText = await resolver.resolveText(text);
      const selectedContent = findSelectionContent();
      await createDocAndFocus(
        new SnippetString(expandedText),
        newFilePath,
        selectedContent ? ViewColumn.Beside : ViewColumn.Active
      );

      if (replaceSelectionWithLink && selectedContent !== undefined) {
        const newNoteTitle = newFilePath.getName();

        await replaceSelection(
          selectedContent.document,
          selectedContent.selection,
          `[[${newNoteTitle}]]`
        );
      }

      return { didCreateFile: true, uri: newFilePath };
    } catch (err) {
      if (err instanceof UserCancelledOperation) {
        return;
      }
      throw err;
    }
  },

  /**
   * Creates a new note using a template.
   * @param templateUri the URI of the template to use.
   * @param resolver the Resolver to use.
   * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
   * @param templateFallbackText the template text to use if the template does not exist. This is configurable by the caller for backwards compatibility purposes.
   */
  createFromTemplate: async (
    templateUri: URI,
    resolver: Resolver,
    filepathFallbackURI?: URI,
    templateFallbackText = '',
    onFileExists?: OnFileExistStrategy
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    try {
      const template = await getTemplateInfo(
        templateUri,
        templateFallbackText,
        resolver
      );

      const newFilePath = asAbsoluteWorkspaceUri(
        template.metadata.has('filepath')
          ? URI.file(template.metadata.get('filepath'))
          : isSome(filepathFallbackURI)
          ? filepathFallbackURI
          : await getPathFromTitle(resolver)
      );

      return NoteFactory.createNote(
        newFilePath,
        template.text,
        resolver,
        onFileExists
      );
    } catch (err) {
      if (err instanceof UserCancelledOperation) {
        return;
      }
      throw err;
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
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    const resolver = new Resolver(
      new Map().set('FOAM_TITLE', dateFormat(targetDate, 'yyyy-mm-dd', false)),
      targetDate
    );
    return NoteFactory.createFromTemplate(
      getDailyNoteTemplateUri(),
      resolver,
      filepathFallbackURI,
      templateFallbackText,
      _ => Promise.resolve(undefined)
    );
  },

  /**
   * Creates a new note when following a placeholder wikilink using the default template.
   * @param wikilinkPlaceholder the placeholder value from the wikilink. (eg. `[[Hello Joe]]` -> `Hello Joe`)
   * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
   * @param chooseTemplate whether the user should be prompted to choose a template for the newly created note
   */
  createForPlaceholderWikilink: async (
    wikilinkPlaceholder: string,
    filepathFallbackURI: URI,
    chooseTemplate: boolean
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    const resolver = new Resolver(
      new Map().set('FOAM_TITLE', wikilinkPlaceholder),
      new Date()
    );

    let templateUri: URI;
    if (chooseTemplate) {
      const selectedTemplate = await askUserForTemplate();
      if (selectedTemplate === undefined) {
        return;
      }
      const templateFilename =
        (selectedTemplate as QuickPickItem).description ||
        (selectedTemplate as QuickPickItem).label;
      templateUri = TEMPLATES_DIR.joinPath(templateFilename);
    } else {
      templateUri = DEFAULT_TEMPLATE_URI;
    }

    return NoteFactory.createFromTemplate(
      getDefaultTemplateUri(),
      resolver,
      filepathFallbackURI,
      WIKILINK_DEFAULT_TEMPLATE_TEXT
    );
  },
};

export const createTemplate = async (): Promise<void> => {
  const defaultFilename = 'new-template.md';
  const defaultTemplate = getTemplatesDir().joinPath(defaultFilename);
  const fsPath = defaultTemplate.toFsPath();
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new template`,
    value: fsPath,
    valueSelection: [fsPath.length - defaultFilename.length, fsPath.length - 3],
    validateInput: async value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : (await fileExists(URI.parse(value)))
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
  defaultFilepath: URI
): Promise<string | undefined> {
  const fsPath = defaultFilepath.toFsPath();
  const defaultFilename = defaultFilepath.getBasename();
  const defaultExtension = defaultFilepath.getExtension();
  return window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: fsPath,
    valueSelection: [
      fsPath.length - defaultFilename.length,
      fsPath.length - defaultExtension.length,
    ],
    validateInput: async value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : (await fileExists(URI.parse(value)))
        ? 'File already exists'
        : undefined,
  });
}

/**
 * Common chars that is better to avoid in file names.
 * Inspired by:
 *   https://www.mtu.edu/umc/services/websites/writing/characters-avoid/
 *   https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names
 * Even if some might be allowed in Win or Linux, to keep things more compatible and less error prone
 * we don't allow them
 * Also see https://github.com/foambubble/foam/issues/1042
 */
const UNALLOWED_CHARS = '/\\#%&{}<>?*$!\'":@+`|=';

/**
 * Uses the title to generate a file path.
 * It sanitizes the title to remove special characters and spaces.
 *
 * @param resolver the resolver to use
 * @returns the string path of the new note
 */
export const getPathFromTitle = async (resolver: Resolver) => {
  let defaultName = await resolver.resolveFromName('FOAM_TITLE');
  UNALLOWED_CHARS.split('').forEach(char => {
    defaultName = defaultName.split(char).join('');
  });

  const defaultFilepath = getCurrentEditorDirectory().joinPath(
    `${defaultName}.md`
  );
  return defaultFilepath;
};
