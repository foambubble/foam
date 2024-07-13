import { commands, ExtensionContext, window, workspace, Uri } from 'vscode';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { fromVsCodeUri, toVsCodeRange } from '../../utils/vsc-utils';
import { ResourceParser } from '../../core/model/note';
import { IMatcher } from '../../core/services/datastore';
import { convertLinkFormat } from '../../core/janitor';
import { isMdEditor } from '../../services/editor';

type LinkFormat = 'wikilink' | 'link';

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
  foam-vscode.convert-link-style-inplace
  foam-vscode.convert-link-style-incopy
  */
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.convert-link-style-inplace', () => {
      return convertLinkAdapter(
        foam.workspace,
        foam.services.parser,
        foam.services.matcher,
        true
      );
    }),
    commands.registerCommand('foam-vscode.convert-link-style-incopy', () => {
      return convertLinkAdapter(
        foam.workspace,
        foam.services.parser,
        foam.services.matcher,
        false
      );
    })
  );
}

async function convertLinkAdapter(
  fWorkspace: FoamWorkspace,
  fParser: ResourceParser,
  fMatcher: IMatcher,
  isInPlace: boolean
) {
  const convertOption = await pickConvertStrategy();
  if (!convertOption) {
    window.showInformationMessage('Convert canceled');
    return;
  }

  if (isInPlace) {
    await convertLinkInPlace(fWorkspace, fParser, fMatcher, convertOption);
  } else {
    await convertLinkInCopy(fWorkspace, fParser, fMatcher, convertOption);
  }
}

async function pickConvertStrategy(): Promise<IConfig | undefined> {
  const options = {
    'to wikilink': ConvertOption.MDlink2Wikilink,
    'to markdown link': ConvertOption.Wikilink2MDlink,
  };
  return window.showQuickPick(Object.keys(options)).then(name => {
    if (name) {
      return Config[options[name]];
    } else {
      return undefined;
    }
  });
}

/**
 * convert links based on its workspace and the note containing it.
 * Changes happen in-place
 * @param fWorkspace
 * @param fParser
 * @param fMatcher
 * @param convertOption
 * @returns void
 */
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
      convertLinkFormat(
        link,
        convertOption.to as LinkFormat,
        fWorkspace,
        resource
      )
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

/**
 * convert links based on its workspace and the note containing it.
 * Changes happen in a copy
 * 1. prepare a copy file, and makt it the activeTextEditor
 * 2. call to convertLinkInPlace
 * @param fWorkspace
 * @param fParser
 * @param fMatcher
 * @param convertOption
 * @returns void
 */
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

  const fileUri = Uri.file(
    `${
      basePath ? basePath + '/' : ''
    }${resource.uri.getName()}.copy${resource.uri.getExtension()}`
  );
  const encoder = new TextEncoder();
  await workspace.fs.writeFile(fileUri, encoder.encode(text));
  await window.showTextDocument(fileUri);

  await convertLinkInPlace(fWorkspace, fParser, fMatcher, convertOption);
}
