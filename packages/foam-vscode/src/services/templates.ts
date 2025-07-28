import { URI } from '../core/model/uri';
import {
  SnippetString,
  ViewColumn,
  QuickPickItem,
  commands,
  window,
  workspace,
} from 'vscode';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { UserCancelledOperation } from './errors';
import {
  asAbsoluteWorkspaceUri,
  createDocAndFocus,
  deleteFile,
  fileExists,
  findSelectionContent,
  focusNote,
  getCurrentEditorDirectory,
  readFile,
  replaceSelection,
} from './editor';
import { Resolver } from './variable-resolver';
import { getFoamVsCodeConfig } from './config';
import { isNone } from '../core/utils';

/**
 * The templates directory
 */
export const getTemplatesDir = () =>
  fromVsCodeUri(workspace.workspaceFolders[0].uri).joinPath(
    '.foam',
    'templates'
  );

/**
 * Gets the candidate URIs for the default note template
 * @returns An array of candidate URIs for the default note template
 */
export const getDefaultNoteTemplateCandidateUris = () => [
  getTemplatesDir().joinPath('new-note.js'),
  getTemplatesDir().joinPath('new-note.md'),
];

/**
 * Gets the default template URI
 * @returns The URI of the default template or undefined if no default template is found
 */
export const getDefaultTemplateUri = async () => {
  for (const uri of getDefaultNoteTemplateCandidateUris()) {
    if (await fileExists(uri)) {
      return uri;
    }
  }
  return undefined;
};

/**
 * Gets the candidate URIs for the daily note template
 * @returns An array of candidate URIs for the daily note template
 */
export const getDailyNoteTemplateCandidateUris = () => [
  getTemplatesDir().joinPath('daily-note.js'),
  getTemplatesDir().joinPath('daily-note.md'),
];

/**
 * Gets the daily note template URI
 * @returns The URI of the daily note template or undefined if no template is found
 */
export const getDailyNoteTemplateUri = async () => {
  for (const uri of getDailyNoteTemplateCandidateUris()) {
    if (await fileExists(uri)) {
      return uri;
    }
  }
  return undefined;
};

const DEFAULT_NEW_NOTE_TEMPLATE = `# \${1:$TM_FILENAME_BASE}

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
    .findFiles('.foam/templates/**{.md,.js}', null)
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

  const [templateMetadata, templateWithFoamFrontmatterRemoved] =
    extractFoamTemplateFrontmatterMetadata(templateWithResolvedVariables);

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

export type OnRelativePathStrategy =
  | 'resolve-from-root'
  | 'resolve-from-current-dir'
  | 'cancel'
  | 'ask'
  | ((filePath: URI) => Promise<URI | undefined>);

export async function askUserForTemplate() {
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

  const selectedTemplate = await window.showQuickPick(items, {
    placeHolder: 'Select a template to use.',
  });

  if (selectedTemplate === undefined) {
    return undefined;
  }
  const templateFilename =
    (selectedTemplate as QuickPickItem).description ||
    (selectedTemplate as QuickPickItem).label;
  const templateUri = getTemplatesDir().joinPath(templateFilename);
  return templateUri;
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

const createFnForOnRelativePathStrategy =
  (onRelativePath: OnRelativePathStrategy | undefined) =>
  async (existingFile: URI) => {
    // Get the default from the configuration
    if (isNone(onRelativePath)) {
      onRelativePath =
        getFoamVsCodeConfig('files.newNotePath') === 'root'
          ? 'resolve-from-root'
          : 'resolve-from-current-dir';
    }

    if (typeof onRelativePath === 'function') {
      return onRelativePath(existingFile);
    }

    switch (onRelativePath) {
      case 'resolve-from-current-dir':
        try {
          return getCurrentEditorDirectory().joinPath(existingFile.path);
        } catch (e) {
          return asAbsoluteWorkspaceUri(existingFile);
        }
      case 'resolve-from-root':
        return asAbsoluteWorkspaceUri(existingFile);
      case 'cancel':
        return undefined;
      case 'ask':
      default: {
        const newProposedPath = await askUserForFilepathConfirmation(
          existingFile
        );
        return newProposedPath && existingFile.with({ path: newProposedPath });
      }
    }
  };

const createFnForOnFileExistsStrategy =
  (onFileExists: OnFileExistStrategy) => async (existingFile: URI) => {
    if (typeof onFileExists === 'function') {
      return onFileExists(existingFile);
    }
    switch (onFileExists) {
      case 'open':
        await commands.executeCommand('vscode.open', toVsCodeUri(existingFile));
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
        return newProposedPath && existingFile.with({ path: newProposedPath });
      }
    }
  };

export const NoteFactory = {
  createNote: async (
    newFilePath: URI,
    text: string,
    resolver: Resolver,
    onFileExistsStrategy?: OnFileExistStrategy,
    onRelativePathStrategy?: OnRelativePathStrategy,
    replaceSelectionWithLink = true
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    try {
      const onRelativePath = createFnForOnRelativePathStrategy(
        onRelativePathStrategy
      );
      const onFileExists =
        createFnForOnFileExistsStrategy(onFileExistsStrategy);

      /**
       * Make sure the path is absolute and doesn't exist
       */
      while ((await fileExists(newFilePath)) || !newFilePath.isAbsolute()) {
        while (!newFilePath.isAbsolute()) {
          const proposedNewFilepath = await onRelativePath(newFilePath);
          if (proposedNewFilepath === undefined) {
            return { didCreateFile: false, uri: newFilePath };
          }
          newFilePath = proposedNewFilepath;
        }
        while (newFilePath.isAbsolute() && (await fileExists(newFilePath))) {
          const proposedNewFilepath = await onFileExists(newFilePath);
          if (proposedNewFilepath === undefined) {
            return { didCreateFile: false, uri: newFilePath };
          }
          newFilePath = proposedNewFilepath;
        }
      }

      newFilePath = asAbsoluteWorkspaceUri(newFilePath, true);
      const expandedText = await resolver.resolveText(text);
      const selectedContent = findSelectionContent();
      await createDocAndFocus(
        new SnippetString(expandedText),
        newFilePath,
        selectedContent ? ViewColumn.Beside : ViewColumn.Active
      );

      if (replaceSelectionWithLink && selectedContent !== undefined) {
        const newNoteTitle = newFilePath.getName();

        // This should really use the FoamWorkspace.getIdentifier() function,
        // but for simplicity we just use newNoteTitle
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

  const filenameURI = defaultTemplate.with({ path: filename });
  await workspace.fs.writeFile(
    toVsCodeUri(filenameURI),
    new TextEncoder().encode(DEFAULT_NEW_NOTE_TEMPLATE)
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
    prompt: `Enter the path for the new note`,
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
        : !URI.parse(value).isAbsolute()
        ? 'Path needs to be absolute'
        : undefined,
  });
}

export const getPathFromTitle = async (scheme: string, resolver: Resolver) => {
  const defaultName = await resolver.resolveFromName('FOAM_TITLE_SAFE');
  return new URI({ scheme, path: `${defaultName}.md` });
};
