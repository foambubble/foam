import { commands, ExtensionContext, window } from 'vscode';
import { isMdEditor } from '../../utils';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { getEditorEOL } from '../../services/editor';
import { ResourceParser } from '../../core/model/note';
import { IMatcher } from '../../core/services/datastore';
import { generateMarkdownLinks } from '../../core/janitor';
const vscode = require('vscode'); /* cannot import workspace from above statement and not sure what happened */

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    commands.registerCommand('foam-vscode.generate-standalone-note', () => {
      return generateStandaloneNote(
        foam.workspace,
        foam.services.parser,
        foam.services.matcher
      );
    })
  );
}

/**
 * based on generate-link-references,
 * copy the current note,
 * replace wikilinks in it,
 * save it at the same directory,
 * call update-wikilinks to remove link references if neccessary
 */
async function generateStandaloneNote(
  fWorkspace: FoamWorkspace,
  fParser: ResourceParser,
  fMatcher: IMatcher
) {
  const editor = window.activeTextEditor;
  const doc = editor.document;

  if (!isMdEditor(editor) || !fMatcher.isMatch(fromVsCodeUri(doc.uri))) {
    return;
  }

  // const setting = getWikilinkDefinitionSetting();
  const eol = getEditorEOL();
  let text = doc.getText();

  const resource = fParser.parse(fromVsCodeUri(doc.uri), text);
  const textReplaceArr = await generateMarkdownLinks(resource, fWorkspace);
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  textReplaceArr.forEach(({ from, to }) => {
    text = text.replace(new RegExp(escapeRegExp(from), 'g'), to);
  });

  const basePath = doc.uri.path.split('/').slice(0, -1).join('/');

  const fileUri = vscode.Uri.file(
    `${
      basePath ? basePath + '/' : ''
    }${resource.uri.getName()}.standalone${resource.uri.getExtension()}`
  );
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(fileUri, encoder.encode(text));
  await window.showTextDocument(fileUri);
  await commands.executeCommand('foam-vscode.update-wikilink-definitions');
}
