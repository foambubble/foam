import { Command, flags } from '@oclif/command';
import * as ora from 'ora';
import * as chalk from 'chalk';
import { initializeNoteGraph, Note, NoteLink } from 'foam-core';
import * as fs from 'fs'

interface InvalidReference {
  note: Note,
  link: NoteLink
}

export default class Lint extends Command {
  static description = 'Shows lint errors and warnings across all the markdown files in the given workspaces';

  // TODO: 
  static examples = [
    `$ foam-cli Lint path-to-foam-workspace
Successfully generated link references and heading!
`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
  }

  static args = [{ name: 'workspacePath' }]

  async run() {
    const spinner = ora('Reading Files').start();

    const { args, flags } = this.parse(Lint)

    const { workspacePath = './' } = args;


    if (fs.existsSync(workspacePath) && fs.lstatSync(workspacePath).isDirectory()) {
      const graph = await initializeNoteGraph(workspacePath);

      const notes = graph.getNotes();

      spinner.text = `${notes.length} files found`;



      // TODO: Figure out why there is an undefined note
      const orphanedNotes = notes.filter(note => note && graph.getBacklinks(note.id).length === 0);

      // Find out invalid references
      // ⚠️ Warning: Dirty code ahead. This is just a proof of concept.
      // @ts-ignore
      const invalidLinks: InvalidReference[] = notes.filter(Boolean).map(note => {
        return graph
          .getNoteLinks(note.id)
          .map(link => {
            const target = graph.getNote(link.to);
            return !target ? { note: note, link: link } : false;
          })
          .filter(Boolean)
      }).reduce((acc, curr) => ([...acc, ...curr]), []) // flatten the array

      const warnings = `${orphanedNotes.map(note => {
        return `→ "${note.title}" is an orphan note.`;
      }).join('\n')}`;


      const errors = `${invalidLinks.map(item => {
        return `→ Link "${item.link.to}" in "${item.note.title}" points to a non-existing note [${item.link.position.start.line}, ${item.link.position.start.column}]   `;
      }).join('\n')}`;


      spinner.stop()

      this.log(chalk.yellowBright('⚠️ Warnings:'));
      this.log(warnings);

      this.log(chalk.redBright('❌ Errors:'));
      console.log(errors);
    }
    else {
      spinner.fail('Directory does not exist!');
    }
  }
}
