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
import { renameFile } from '../utils/rename-file';
import { isValidDirectory } from '../utils';

// @todo: Refactor 'migrate' and 'janitor' commands and avoid repeatition
export default class Migrate extends Command {
  static description =
    'Updates file names, link references and heading across all the markdown files in the given workspaces';

  static examples = [
    `$ foam-cli migrate path-to-foam-workspace
Successfully generated link references and heading!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  static args = [{ name: 'workspacePath' }];

  async run() {
    const spinner = ora('Reading Files').start();

    const { args, flags } = this.parse(Migrate);

    const { workspacePath = './' } = args;

    if (isValidDirectory(workspacePath)) {
      let graph = await initializeNoteGraph(workspacePath);

      let notes = graph.getNotes().filter(Boolean); // removes undefined notes

      spinner.succeed();
      spinner.text = `${notes.length} files found`;
      spinner.succeed();

      // exit early if no files found.
      if (notes.length === 0) {
        this.exit();
      }

      // Kebab case file names
      const fileRename = notes.map(note => {
        const kebabCasedFileName = getKebabCaseFileName(note.title);
        if (kebabCasedFileName) {
          return renameFile(note.path, kebabCasedFileName);
        }
        return Promise.resolve(null);
      });

      await Promise.all(fileRename);

      spinner.text = 'Renaming files';

      // Reinitialize the graph after renaming files
      graph = await initializeNoteGraph(workspacePath);

      notes = graph.getNotes().filter(Boolean); // remove undefined notes

      spinner.succeed();
      spinner.text = 'Generating link definitions';

      const fileWritePromises = await Promise.all(
        notes.map(note => {
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
        })
      );

      await Promise.all(fileWritePromises);

      spinner.succeed();
      spinner.succeed('Done!');
    } else {
      spinner.fail('Directory does not exist!');
    }
  }
}
