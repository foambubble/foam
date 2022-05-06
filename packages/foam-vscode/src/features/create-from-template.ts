import { commands, ExtensionContext, QuickPickItem, window } from 'vscode';
import { FoamFeature } from '../types';
import {
  createTemplate,
  DEFAULT_TEMPLATE_URI,
  getTemplateMetadata,
  getTemplates,
  NoteFactory,
  TEMPLATES_DIR,
} from '../services/templates';
import { Resolver } from '../services/variable-resolver';

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

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-note-from-template',
        async () => {
          const selectedTemplate = await askUserForTemplate();
          if (selectedTemplate === undefined) {
            return;
          }
          const templateFilename =
            (selectedTemplate as QuickPickItem).description ||
            (selectedTemplate as QuickPickItem).label;
          const templateUri = TEMPLATES_DIR.joinPath(templateFilename);

          const resolver = new Resolver(new Map(), new Date());

          await NoteFactory.createFromTemplate(templateUri, resolver);
        }
      )
    );
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-note-from-default-template',
        () => {
          const resolver = new Resolver(new Map(), new Date());

          return NoteFactory.createFromTemplate(
            DEFAULT_TEMPLATE_URI,
            resolver,
            undefined,
            `---
foam_template:
  name: New Note
  description: Foam's default new note template
---
# \${FOAM_TITLE}

\${FOAM_SELECTED_TEXT}
`
          );
        }
      )
    );
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-new-template',
        createTemplate
      )
    );
  },
};

export default feature;
