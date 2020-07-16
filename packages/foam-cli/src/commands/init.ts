/*eslint-disable no-unused-vars*/

import { Command, flags } from '@oclif/command';
import * as inquirer from 'inquirer';
import * as ora from 'ora';

// @todo implement this class, currently it does nothing but collect inputs
export default class Init extends Command {
  static description = 'Initialize a new Foam workspace from template';

  // @todo better examples
  static examples = [`$ foam init`];

  // @todo validate inputs
  static flags = {
    help: flags.help({ char: 'h' }),
    name: flags.string({
      char: 'n',
      description: 'workspace name',
    }),

    scm: flags.string({
      char: 's',
      description: 'source control (github, git, local)'
    }),

    template: flags.string({
      char: 't',
      description: 'template'
    }),

    gitHubUser: flags.string({
      char: 'u',
      description: 'github username'
    }),

    gitHubPassword: flags.string({
      description: 'github password'
    }),

    // @todo make flag
    githubPages: flags.string({
      char: 'p',
      description: 'enable github pages'
    }),

    repoOwner: flags.string({
      char: 'p',
      description: 'github repo owner'
    }),

    visibility: flags.string({
      char: 'v',
      description: 'github repo visibility (public/private)'
    }),
  };

  async run() {
    const { flags } = this.parse(Init);

    const name =
      flags.name ||
      (await inquirer.prompt({
        name: 'name',
        message: 'Give your workspace a name',
        type: 'input',
        default: 'foam',
      })).name;

    const template =
      flags.template ||
      (await inquirer.prompt({
        name: 'template',
        message: 'Choose from one of the available templates',
        type: 'list',
        choices: [
          { name: 'Default (foam-template)' },
          { name: 'Gatsby + GitHub Actions (foam-template-gatsby)' },
          { name: '11ty + Netlify (foam-template-eleventy)' },
          { name: 'MLH Fellowship Workspace (foam-template-mlh)' },
        ],
      })).template;

    const scm = (await inquirer.prompt([
      {
        name: 'scm',
        message: 'How do you want to store your workspace?',
        type: 'list',
        default: 'GitHub',
        choices: [
          { name: 'GitHub' },
          { name: 'Local git repository' },
          { name: 'Local directory (no source control)' },
        ],
      },
    ])).scm;

    if (scm === 'GitHub') {
      const userName =
        flags.gitHubUser ||
        (await inquirer.prompt({
          name: 'username',
          message: 'GitHub username',
          type: 'input'
        })).username;

      const password =
        flags.gitHubPassword ||
        (await inquirer.prompt({
          name: 'password',
          message: 'GitHub password',
          type: 'password'
        })).password;

      const owner =
        flags.repoOwner ||
        (await inquirer.prompt({
          name: 'owner',
          message: 'GitHub repository owner',
          type: 'input',
          default: userName
        })).owner;

      const visibility =
        flags.visibility ||
        (await inquirer.prompt({
          name: 'visibility',
          message: 'Should the repository be public or private?',
          type: 'list',
          choices: [
            { name: 'Public' },
            { name: 'Private' }
          ],
        })).visibility.toLowerCase();

      const pages =
        flags.githubPages ||
        ((await inquirer.prompt({
          name: 'pages',
          message: 'Publish automatically to GitHub pages?',
          type: 'list',
          choices: [
            { name: 'Yes' },
            { name: 'No' }
          ],
        })).pages === 'Yes');


      const sure = (await inquirer.prompt({
        name: 'sure',
        type: 'confirm',
        message: `Create a new ${visibility} Foam in https://github.com/${owner}/${name}?`
      })).sure;

      if (sure) {
        const spinner = ora().start();
        await new Promise(resolve => {
          setTimeout(() => resolve(), 1000);
        });
        spinner.succeed();
        spinner.succeed('Foam workspace created!');
        spinner.succeed('Run "code foam" to open your new workspace');
      }
    } else {
      console.log(`Created a private Foam workspace in ./${name}`);
    }
  }
}
