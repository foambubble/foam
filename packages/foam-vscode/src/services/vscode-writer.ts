import * as vscode from 'vscode';
import { IWriter } from '../core/services/Writer/iwriter';
import { Resource } from '../core/model/note';
import { resolve } from 'path';
import { toVsCodeUri } from '../utils/vsc-utils';

export class VSCodeWriter implements IWriter {
  async write(note: Resource): Promise<void> {
    var document = await vscode.workspace.openTextDocument(
      toVsCodeUri(note.uri)
    );

    if (document) {
      var result = await document.save();
      if (result) {
        resolve('successfully saved Document');
      }
    }

    throw new Error(`error while saving Node ${note.uri}`);
  }
}
