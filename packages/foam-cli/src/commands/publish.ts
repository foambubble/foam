import {Command, flags} from '@oclif/command'
import { execSync } from 'child_process';
import * as ora from 'ora';


export default class Publish extends Command {
  static description = 'Push all changes to git repository';

  static examples = [
    `$ foam publish -m "Optional log message"`,
  ]

  static flags = {
    message: flags.string({
      char: 'm',
      description: "optional message"
    }),
    remote: flags.string({
      char: 'r',
      description: "remote"
    }),
    branch: flags.string({
      char: 'b',
      description: "branch"
    })
  }

  async execWithSpinner(command: string, message: string) {
    const spinner = ora(message).start();

    // @todo handle errors
    const response = execSync(command).toString();

    spinner.succeed(`${message} Done!`);

    return response;
  }

  async printPublishInfo(remote: string) {
    // @todo actually get this data from GH API

    const [, remotePath] = execSync(`git remote get-url ${remote}`).toString().trim().split(':');
    const [repo, org] = remotePath.split('/').reverse();
    console.log('');
    console.log(`🎉 Your changes will be available shortly at https://${org}.github.io/${repo.replace('.git', '')}`);
    console.log('');

  }

  async run() {
    const {flags} = this.parse(Publish);

    // @todo improve
    const message = flags.message || 'foam publish';
    const remote = flags.remote || 'origin';
    const branch = flags.branch || 'master';

    await this.execWithSpinner(`git add -A`, 'Staging changes...');
    await this.execWithSpinner(`git commit -m "${message}"`, 'Creating a commit...');
    await this.execWithSpinner(`git push ${remote} ${branch}`, "Publishing...");
    await this.printPublishInfo(remote);
  }
}
