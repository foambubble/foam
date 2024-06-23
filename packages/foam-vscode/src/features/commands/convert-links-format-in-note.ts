import { commands, ExtensionContext, window } from 'vscode';
import { isMdEditor } from '../../utils';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { fromVsCodeUri, toVsCodeRange } from '../../utils/vsc-utils';
import { ResourceParser } from '../../core/model/note';
import { IMatcher } from '../../core/services/datastore';
import { convertLinkFormat } from '../../core/janitor';
const vscode = require('vscode'); /* cannot import workspace from above statement and not sure what happened */

enum ConvertOption {
  Wikilink2MDlink,
  MDlink2Wikilink,
}

interface IConfig {
  from: string;
  to: string;
}

const Config: { [key in ConvertOption]: IConfig } = {
  [ConvertOption.Wikilink2MDlink]: {
    from: 'wikilink',
    to: 'link',
  },
  [ConvertOption.MDlink2Wikilink]: {
    from: 'link',
    to: 'wikilink',
  },
};

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  /* 
  commands:
  foam-vscode.convert-wikilink-to-markdownlink-inplace
  foam-vscode.convert-markdownlink-to-wikilink-inplace
  foam-vscode.convert-wikilink-to-markdownlink-in-copy
  foam-vscode.convert-markdownlink-to-wikilink-in-copy
   */
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.convert-wikilink-to-markdownlink-inplace',
      () => {
        return convertLinkInPlace(
          foam.workspace,
          foam.services.parser,
          foam.services.matcher,
          Config[ConvertOption.Wikilink2MDlink]
        );
      }
    ),
    commands.registerCommand(
      'foam-vscode.convert-markdownlink-to-wikilink-inplace',
      () => {
        return convertLinkInPlace(
          foam.workspace,
          foam.services.parser,
          foam.services.matcher,
          Config[ConvertOption.MDlink2Wikilink]
        );
      }
    ),
    commands.registerCommand(
      'foam-vscode.convert-wikilink-to-markdownlink-incopy',
      () => {
        return convertLinkInCopy(
          foam.workspace,
          foam.services.parser,
          foam.services.matcher,
          Config[ConvertOption.Wikilink2MDlink]
        );
      }
    ),
    commands.registerCommand(
      'foam-vscode.convert-markdownlink-to-wikilink-incopy',
      () => {
        return convertLinkInCopy(
          foam.workspace,
          foam.services.parser,
          foam.services.matcher,
          Config[ConvertOption.MDlink2Wikilink]
        );
      }
    )
  );
}

async function convertLinkInPlace(
  fWorkspace: FoamWorkspace,
  fParser: ResourceParser,
  fMatcher: IMatcher,
  convertOption: IConfig
) {
  const editor = window.activeTextEditor;
  const doc = editor.document;

  if (!isMdEditor(editor) || !fMatcher.isMatch(fromVsCodeUri(doc.uri))) {
    return;
  }
  // const eol = getEditorEOL();
  let text = doc.getText();

  const resource = fParser.parse(fromVsCodeUri(doc.uri), text);

  const textReplaceArr = resource.links
    .filter(link => link.type === convertOption.from)
    .map(link =>
      convertLinkFormat(link, convertOption.to, fWorkspace, resource)
    )
    /* transform .range property into vscode range */
    .map(linkReplace => ({
      ...linkReplace,
      range: toVsCodeRange(linkReplace.range),
    }));

  /* reorder the array such that the later range comes first */
  textReplaceArr.sort((a, b) => b.range.start.compareTo(a.range.start));

  await editor.edit(editorBuilder => {
    textReplaceArr.forEach(edit => {
      editorBuilder.replace(edit.range, edit.newText);
    });
  });
}

async function convertLinkInCopy(
  fWorkspace: FoamWorkspace,
  fParser: ResourceParser,
  fMatcher: IMatcher,
  convertOption: IConfig
) {
  const editor = window.activeTextEditor;
  const doc = editor.document;

  if (!isMdEditor(editor) || !fMatcher.isMatch(fromVsCodeUri(doc.uri))) {
    return;
  }
  // const eol = getEditorEOL();
  let text = doc.getText();

  const resource = fParser.parse(fromVsCodeUri(doc.uri), text);
  const basePath = doc.uri.path.split('/').slice(0, -1).join('/');

  const fileUri = vscode.Uri.file(
    `${
      basePath ? basePath + '/' : ''
    }${resource.uri.getName()}.copy${resource.uri.getExtension()}`
  );
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(fileUri, encoder.encode(text));
  await window.showTextDocument(fileUri);

  await convertLinkInPlace(fWorkspace, fParser, fMatcher, convertOption);
}
