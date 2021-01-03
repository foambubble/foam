import { Command, flags } from '@oclif/command';
import ora from 'ora';
import {
  bootstrap,
  createConfigFromFolders,
  generateLinkReferences,
  generateHeading,
  applyTextEdit,
  Services,
  FileDataStore,
  URI,
} from 'foam-core';
import { writeFileToDisk } from '../utils/write-file-to-disk';
import { isValidDirectory } from '../utils';

export default class Janitor extends Command {
  static description =
    'Updates link references and heading across all the markdown files in the given workspaces';

  static examples = [
    `$ foam-cli janitor path-to-foam-workspace
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

    const { args, flags } = this.parse(Janitor);

    const { workspacePath = './' } = args;

    if (isValidDirectory(workspacePath)) {
      const config = createConfigFromFolders([URI.file(workspacePath)]);
      const services: Services = {
        dataStore: new FileDataStore(config),
      };
      const graph = (await bootstrap(config, services)).notes;

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
      });

      await Promise.all(fileWritePromises);

      spinner.succeed();
      spinner.succeed('Done!');
    } else {
      spinner.fail('Directory does not exist!');
    }
  }
}
