import * as vscode from 'vscode';
import { IWriter } from '../core/services/Writer/iwriter';
import { Resource, Section } from '../core/model/note';
import { resolve } from 'path';
import { toVsCodeUri } from '../utils/vsc-utils';
import { URI } from '../core/model/uri';
import { replaceSelection } from './editor';

export class VSCodeWriter implements IWriter {
  async write(note: Resource): Promise<void> {
    var document = await this.GetDocument(note.uri);
    await this.Overwrite(
      document,
      VSCodeWriter.SectionsToString(note.sections)
    );
    //TODO: does the change have to be saved or doas this happen automatically in workspace.aplyEdit() ?
    await this.Save(document);
  }

  private async GetDocument(uri: URI) {
    var document = await vscode.workspace.openTextDocument(toVsCodeUri(uri));

    if (!document) {
      throw new Error(`Could not find Document ${uri}`);
    } else {
      return document;
    }
  }

  private async Overwrite(document: vscode.TextDocument, newContent: string) {
    let invalidRange = new vscode.Range(0, 0, document.lineCount, 0);
    let fullRange = document.validateRange(invalidRange);
    await replaceSelection(
      document,
      new vscode.Selection(fullRange.start, fullRange.end),
      newContent
    );
  }

  private async Save(document: vscode.TextDocument) {
    var result = await document.save();
    if (result) {
      resolve('successfully saved Document');
    } else {
      throw new Error(`error while saving Node ${document.uri}`);
    }
  }

  public static SectionsToString(sections: Section[]) {
    var result = '';
    sections.forEach(section => {
      result += section.label;
    });

    return result;
  }
}
