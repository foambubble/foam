import { Command, flags } from '@oclif/command';
import ora from 'ora';
import {
  bootstrap,
  createConfigFromFolders,
  generateLinkReferences,
  generateHeading,
  getKebabCaseFileName,
  applyTextEdit,
  Services,
  FileDataStore,
} from 'foam-core';
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
    'without-extensions': flags.boolean({
      char: 'w',
      description:
        'generate link reference definitions without extensions (for legacy support)',
    }),
    help: flags.help({ char: 'h' }),
  };

  static args = [{ name: 'workspacePath' }];

  async run() {
    const spinner = ora('Reading Files').start();

    const { args, flags } = this.parse(Migrate);

    const { workspacePath = './' } = args;
    const config = createConfigFromFolders([workspacePath]);

    if (isValidDirectory(workspacePath)) {
      const services: Services = {
        dataStore: new FileDataStore(config),
      };
      let graph = (await bootstrap(config, services)).notes;

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
        if (note.title != null) {
          const kebabCasedFileName = getKebabCaseFileName(note.title);
          if (kebabCasedFileName) {
            return renameFile(note.uri, kebabCasedFileName);
          }
        }
        return Promise.resolve(null);
      });

      await Promise.all(fileRename);

      spinner.text = 'Renaming files';

      // Reinitialize the graph after renaming files
      graph = (await bootstrap(config, services)).notes;

      notes = graph.getNotes().filter(Boolean); // remove undefined notes

      spinner.succeed();
      spinner.text = 'Generating link definitions';

      const fileWritePromises = await Promise.all(
        notes.map(note => {
          // Get edits
          const heading = generateHeading(note);
          const definitions = generateLinkReferences(
            note,
            graph,
            !flags['without-extensions']
          );

          // apply Edits
          let file = note.source.text;
          file = heading ? applyTextEdit(file, heading) : file;
          file = definitions ? applyTextEdit(file, definitions) : file;

          if (heading || definitions) {
            return writeFileToDisk(note.uri, file);
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
