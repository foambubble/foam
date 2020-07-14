import { Command, flags } from '@oclif/command'
import { initializeNoteGraph, generateLinkReferences, generateHeading } from 'foam-core';
import * as path from 'path';
import { applyTextEdit } from '../utils/apply-text-edit';
import { writeFileToDisk } from '../utils/write-file-to-disk';


export default class Janitor extends Command {
  static description = 'Updates link references and heading across all the markdown files in the given workspaces';

  static examples = [
    `$ foam-cli janitor path-to-foam-workspace
Sucessfully generated link references and heading!
`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
  }

  static args = [{ name: 'workspacePath' }]

  async run() {
    const { args, flags } = this.parse(Janitor)

    const { workspacePath = './' } = args;

    const foamWorkspaceDir = path.join(__dirname, workspacePath);

    const graph = await initializeNoteGraph(foamWorkspaceDir);

    const notes = graph.getNotes();

    const fileWritePromises = notes.map(note => {
      const heading = generateHeading(note);

      const fileWithHeading = heading ? applyTextEdit(note.source, heading) : note.source;

      const linkRefTextEdits = generateLinkReferences(note, graph);

      const fileWithLinkReferences = linkRefTextEdits ? applyTextEdit(fileWithHeading, linkRefTextEdits) : fileWithHeading;

      if (fileWithHeading || fileWithLinkReferences) {
        return writeFileToDisk(note.path, fileWithLinkReferences);
      }

      return null;
    })


    // TODO: Add a loader

    await Promise.all(fileWritePromises);


    // Improve the message (also show changed files??)
    // Use Chalk
    this.log('Succfully generated link references and heading!')
  }
}
