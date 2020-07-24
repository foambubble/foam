import {
  window,
  workspace,
  ExtensionContext,
  commands,
  Position,
  Range
} from "vscode";
import fs = require("fs");
import { FoamFeature } from "../types";
import {
  generateLinkReferences,
  generateHeading,
  Foam,
  Note,
  applyTextEdit
} from 'foam-core';

import {
  bootstrap,
  getConfig
} from '../extension';


const feature: FoamFeature = {
  activate: async (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.janitor", () => janitor(foam))
    );
  },
};

async function janitor(foam: Foam) {
  const foamNew = await bootstrap(getConfig()); 
  const notes = foamNew.notes.getNotes().filter(Boolean);

  const dirtyEditors = window.visibleTextEditors.filter(editor => editor.document.isDirty);
  const dirtyEditorsFileName = dirtyEditors.map(editor => editor.document.fileName);

  const dirtyNotes: Note[] = notes.filter(note => dirtyEditorsFileName.includes(note.path));
  const nonDirtyNotes: Note[] = notes.filter(note => !dirtyEditorsFileName.includes(note.path));

  console.log(nonDirtyNotes, dirtyNotes);

  // Apply Text Edits to Non Dirty Notes using fs module just like CLI

  const fileWritePromises = nonDirtyNotes.map(note => {
     // get edits
     const heading = generateHeading(note);
     let definitions = generateLinkReferences(note, foam.notes);

     // apply Edits
     let text = note.source;
     text = heading ? applyTextEdit(text, heading) : text;
     text = definitions ? applyTextEdit(text, definitions) : text;

     return fs.promises.writeFile(note.path, text);
   });

   await Promise.all(fileWritePromises);


  // Handle dirty editors 


   dirtyEditors.map(async editor => {
     let text = editor.document.getText(); // This includes unsaved changes as well

     const note = dirtyNotes.find(n => n.path === editor.document.fileName);

     // Get edits
     const heading = generateHeading(note);
     let definitions = generateLinkReferences(note, foam.notes);

     console.log(heading);
     // apply Edits
     editor.edit(editBuilder => {
       if(heading) {
        const start = new Position(heading.range.start.line, heading.range.start.column);
        console.log(start, heading.newText);
        editBuilder.insert(start, heading.newText);
      }
      if(definitions) {
        const start = new Position(definitions.range.start.line - 1, definitions.range.start.column);
        const end = new Position(definitions.range.end.line - 1, definitions.range.end.column);
        const range = new Range(start, end);
        editBuilder.replace(range, definitions!.newText);
      }
     });

     // Use editor.edit API to apply the text edit

     

    });
}


export default feature;
