import {Command, flags} from '@oclif/command'
import { NoteGraph } from '@foam/core';
export default class Hello extends Command {
  static description = 'describe the command here'

  static examples = [
    `$ foam hello
hello world from ./src/hello.ts!
`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  }

  static args = [{name: 'file'}]

  async run() {
    const {args, flags} = this.parse(Hello)
    const name = flags.name ?? 'world'

    const wm = new NoteGraph();
    wm.addNoteFromMarkdown('page-a.md', `
# Page A
## Section
- [[page-b]]
- [[page-c]];
    `);

    wm.addNoteFromMarkdown('page-a.md', `
# Page B
This references [[page-a]]`);

    console.log(wm.getNoteWithLinks('page-a'));




  }
}
