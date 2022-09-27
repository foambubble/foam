import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { URI } from '../../core/model/uri';
import { NoteFactory } from '../../services/templates';
import { Foam } from '../../core/model/foam';
import { Resolver } from '../../services/variable-resolver';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { isNone } from '../../utils';
import { fileExists } from '../../services/editor';

interface CreateNoteArgs {
  notePath?: string;
  templatePath?: string;
  text?: string;
  variables?: Map<string, string>;
  date?: Date;
  onFileExists?: 'overwrite' | 'open' | 'ask' | 'cancel';
}

async function createNote(args: CreateNoteArgs) {
  const resolver = new Resolver(
    new Map(Object.entries(args.variables)),
    args.date ?? new Date()
  );
  if (isNone(args.notePath) && isNone(args.templatePath)) {
    throw new Error('Either notePath or templatePath must be provided');
  }
  const noteUri = args.notePath && URI.file(args.notePath);
  const templateUri = args.templatePath && URI.file(args.templatePath);
  const onFileExists = async (uri: URI) => {
    switch (args.onFileExists) {
      case 'open':
        vscode.commands.executeCommand('vscode.open', toVsCodeUri(uri));
        return;
      case 'overwrite':
        await vscode.workspace.fs.delete(toVsCodeUri(uri));
        return uri;
      case 'cancel':
        return undefined;
      case 'ask':
        throw new Error('not implemented');
      default:
        vscode.commands.executeCommand('vscode.open', toVsCodeUri(uri));
        return;
    }
  };
  if (await fileExists(templateUri)) {
    return NoteFactory.createFromTemplate(
      templateUri,
      resolver,
      noteUri,
      args.text,
      onFileExists
    );
  } else {
    return NoteFactory.createNote(
      noteUri,
      new vscode.SnippetString(args.text),
      resolver,
      onFileExists,
      true
    );
  }
}

export const CREATE_NOTE_COMMAND = {
  command: 'foam-vscode.create-note',
  title: 'Foam: Create Note',

  asURI: (uri: URI) =>
    vscode.Uri.parse(`command:${CREATE_NOTE_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify({ uri })),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(CREATE_NOTE_COMMAND.command, createNote)
    );
  },
};

export default feature;
