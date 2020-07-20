import { Command, flags } from '@oclif/command';
import * as ora from 'ora';
import {
  initializeNoteGraph,
  generateLinkReferences,
  generateHeading,
  getKebabCaseFileName,
} from 'foam-core';
import { applyTextEdit } from '../utils/apply-text-edit';
import { writeFileToDisk } from '../utils/write-file-to-disk';
import { isValidDirectory } from '../utils';

export default class Janitor extends Command {
  static description =
    'Updates link references and heading across all the markdown files in the given workspaces';

  static examples = [
    `$ foam-cli janitor path-to-foam-workspace
Successfully generated link references and heading!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  static args = [{ name: 'workspacePath' }];

  async run() {
    const spinner = ora('Reading Files').start();

    const { args, flags } = this.parse(Janitor);

    const { workspacePath = './' } = args;

    if (isValidDirectory(workspacePath)) {
      const graph = await initializeNoteGraph(workspacePath);

      const notes = graph.getNotes().filter(Boolean); // removes undefined notes

      spinner.succeed();
      spinner.text = `${notes.length} files found`;
      spinner.succeed();

      // exit early if no files found.
      if (notes.length === 0) {
        this.exit();
      }

      spinner.text = 'Generating link definitions';

      const fileWritePromises = notes.map(note => {
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

        return Promise.resolve(null);
      });

      await Promise.all(fileWritePromises);

      spinner.succeed();
      spinner.succeed('Done!');
    } else {
      spinner.fail('Directory does not exist!');
    }
  }
}
