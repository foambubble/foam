import { IWriter } from '../core/services/Writer/iwriter';
import { stringify as stringifyYaml } from 'yaml';
import { TrainNote } from '../core/model/train-note';
import { URI } from '../core/model/uri';
import unified from 'unified';
import visit from 'unist-util-visit';
import frontmatterPlugin from 'remark-frontmatter';
import markdownParse from 'remark-parse';
import markdownStringify from 'remark-stringify';
import { readFile } from './editor';

export class FrontmatterWriter implements IWriter {
  async write(note: TrainNote): Promise<void> {
    try {
      var yaml = this.Transform(note);
      await this.WriteFrontmatter(yaml, note.uri);
    } catch (error) {
      throw new Error('Could not replace Frontmatter: \n' + error);
    }
  }

  private Transform(note: TrainNote) {
    const currentPhase = stringifyYaml(note.CurrentPhase());
    const nextReminder = stringifyYaml(note.nextReminder);
    var result = currentPhase + nextReminder;
    if (note.properties != null) {
      result += stringifyYaml(note.properties);
    }

    return result;
  }

  private async WriteFrontmatter(yaml: string, uri: URI) {
    //unifiedjs anwenden
    //remarkfrontmatter
    //custom plugin to replace Frontmatter
    //remark stringify
    const markdown = await readFile(uri);

    await unified()
      .use(markdownParse, { gfm: true })
      .use(frontmatterPlugin, ['yaml'])
      .use(replaceFrontmatter, yaml)
      .use(markdownStringify)
      .process(markdown);

    console.log(markdown);
  }
}

export default function replaceFrontmatter(yaml: string) {
  //inspiered by: https://github.com/orgs/remarkjs/discussions/1210
  return function (tree) {
    visit(tree, node => {
      if (node.type === 'yaml') {
        (node as any).value = yaml;
      }
    });
  };
}
