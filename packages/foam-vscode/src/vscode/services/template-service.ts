import { QuickPickItem, commands, window, workspace } from 'vscode';
import { URI } from '../../core/model/uri';
import { getDailyNoteTemplateCandidateUris } from '../../core/templates/template-discovery';
import { extractFoamTemplateFrontmatterMetadata } from '../../core/utils/template-frontmatter-parser';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { fileExists, focusNote, readFile } from '../../services/editor';
import { getFoamVsCodeConfig } from '../config';

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

export const getTemplatesDir = () => {
  const folder = getFoamVsCodeConfig('templates.folder', '.foam/templates');
  return fromVsCodeUri(workspace.workspaceFolders[0].uri).joinPath(
    ...folder.split('/')
  );
};

export const getDefaultNoteTemplateCandidateUris = () => [
  getTemplatesDir().joinPath('new-note.js'),
  getTemplatesDir().joinPath('new-note.md'),
];

export const getDefaultTemplateUri = async () => {
  for (const uri of getDefaultNoteTemplateCandidateUris()) {
    if (await fileExists(uri)) {
      return uri;
    }
  }
  return undefined;
};

export const getDailyNoteTemplateUri = async () => {
  for (const uri of getDailyNoteTemplateCandidateUris(getTemplatesDir())) {
    if (await fileExists(uri)) {
      return uri;
    }
  }
  return undefined;
};

export async function getTemplates(): Promise<URI[]> {
  const folder = getFoamVsCodeConfig('templates.folder', '.foam/templates');
  const templates = await workspace
    .findFiles(`${folder}/**{.md,.js}`, null)
    .then(v => v.map(uri => fromVsCodeUri(uri)));
  return templates;
}

async function getTemplateMetadata(
  templateUri: URI
): Promise<Map<string, string>> {
  const contents = (await readFile(templateUri)) ?? '';
  const [templateMetadata] = extractFoamTemplateFrontmatterMetadata(contents);
  return templateMetadata;
}

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
        : (await fileExists(getTemplatesDir().forPath(value)))
        ? 'File already exists'
        : undefined,
  });
  if (filename === undefined) {
    return;
  }

  const filenameURI = defaultTemplate.forPath(filename);
  await workspace.fs.writeFile(
    toVsCodeUri(filenameURI),
    new TextEncoder().encode(DEFAULT_NEW_NOTE_TEMPLATE)
  );
  await focusNote(filenameURI, false);
};
