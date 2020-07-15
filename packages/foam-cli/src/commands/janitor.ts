import { Command, flags } from '@oclif/command';
import * as ora from 'ora';
import { initializeNoteGraph, generateLinkReferences, generateHeading, getKebabCaseFileName } from 'foam-core';
import { applyTextEdit } from '../utils/apply-text-edit';
import { writeFileToDisk } from '../utils/write-file-to-disk';
import { renameFile } from '../utils/rename-file';
import * as fs from 'fs'


export default class Janitor extends Command {
  static description = 'Updates link references and heading across all the markdown files in the given workspaces';

  static examples = [
    `$ foam-cli janitor path-to-foam-workspace
Successfully generated link references and heading!
`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
  }

  static args = [{ name: 'workspacePath' }]

  async run() {
    const spinner = ora('Reading Files').start();

    const { args, flags } = this.parse(Janitor)

    const { workspacePath = './' } = args;

    if (fs.existsSync(workspacePath) && fs.lstatSync(workspacePath).isDirectory()) {
      const graph = await initializeNoteGraph(workspacePath);

      const notes = graph.getNotes();

      spinner.succeed();
      spinner.text = `${notes.filter(note => note !== undefined).length} files found`;

      spinner.succeed();
      spinner.text = 'Generating link definitions'

      const fileWritePromises = await Promise.all(notes.map(note => {
        if(!note) {
          return null;
        }

        // Get edits
        const heading = generateHeading(note);
        const definitions = generateLinkReferences(note, graph);


        // apply Edits
        let file = note.source;
        file = heading ? applyTextEdit(file, heading) : file;
        file = definitions ? applyTextEdit(file, definitions) : file;


        if (heading || definitions) {
          return writeFileToDisk(note.path, file);
        }

        return null;
      }))

      await Promise.all(fileWritePromises);

      spinner.succeed();
      spinner.succeed('Done!');
    }
    else {
      spinner.fail('Directory does not exist!');
    }
  }
}
