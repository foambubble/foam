import { QuickPickItem, commands, window, workspace } from 'vscode';
import { URI } from '@foam/core';
import {
  findFirstTemplate,
  getDailyNoteTemplateCandidateUris,
  getNewNoteTemplateCandidateUris,
  getTemplatesDir as getTemplatesDirIn,
  isPathWithin,
} from '@foam/core';
import { extractFoamTemplateFrontmatterMetadata } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { fileExists, focusNote, readFile } from './editor';
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

/** Where new templates are created: the first workspace root's folder. */
export const getTemplatesDir = () =>
  getTemplatesDirIn(fromVsCodeUri(workspace.workspaceFolders[0].uri));

// Default templates are looked up in every root, so one kept in a notes
// folder added as a secondary root works in every workspace (#1711).
const getAllTemplatesDirs = () =>
  workspace.workspaceFolders.map(folder =>
    getTemplatesDirIn(fromVsCodeUri(folder.uri))
  );

export const getDefaultTemplateUri = () =>
  findFirstTemplate(
    getAllTemplatesDirs(),
    getNewNoteTemplateCandidateUris,
    fileExists
  );

export const getDailyNoteTemplateUri = () =>
  findFirstTemplate(
    getAllTemplatesDirs(),
    getDailyNoteTemplateCandidateUris,
    fileExists
  );

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
        const folder = workspace.workspaceFolders.find(candidate =>
          isPathWithin(templateUri.path, fromVsCodeUri(candidate.uri).path)
        )?.name;
        const label = metadata.get('name') || metadata.get('templatePath');
        return { templateUri, metadata, folder, label };
      })
    )
  ).sort((t1, t2) => sortTemplatesMetadata(t1.metadata, t2.metadata));

  // Templates in different workspace folders can share a label, e.g. a
  // `meeting.md` in each: only then is the folder shown, to tell them apart.
  const foldersByLabel = new Map<string, Set<string>>();
  for (const { label, folder } of templatesMetadata) {
    foldersByLabel.set(
      label,
      (foldersByLabel.get(label) ?? new Set()).add(folder)
    );
  }

  const items: (QuickPickItem & { templateUri: URI })[] = await Promise.all(
    templatesMetadata.map(({ templateUri, metadata, folder, label }) => {
      const description = [
        metadata.get('name') ? metadata.get('templatePath') : undefined,
        foldersByLabel.get(label).size > 1 ? folder : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
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
      // The label only shows the basename, so keep the listed file itself:
      // it may be in a subfolder, or in another root of a multi-root
      // workspace (#1711).
      return { ...item, templateUri };
    })
  );

  const selectedTemplate = await window.showQuickPick(items, {
    placeHolder: 'Select a template to use.',
  });

  return selectedTemplate?.templateUri;
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
