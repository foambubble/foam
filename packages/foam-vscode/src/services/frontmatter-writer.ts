import { IWriter } from '../core/services/Writer/iwriter';
import { URI } from '../core/model/uri';
import { readFile } from './editor';
import { workspace } from 'vscode';
import { toVsCodeUri } from '../utils/vsc-utils';
import matter from 'gray-matter';

export class FrontmatterWriter implements IWriter {
  async write(object: any, uri: URI): Promise<void> {
    try {
      const markdown = await readFile(uri);
      var result = this.ReplaceFrontmatter(markdown, object);
      await workspace.fs.writeFile(
        toVsCodeUri(uri),
        new TextEncoder().encode(result)
      );
      console.log(result);
    } catch (error) {
      throw new Error('Could not replace Frontmatter: \n' + error);
    }
  }

  private ReplaceFrontmatter(markdown: string, object: any) {
    var file = matter(markdown);
    return matter.stringify(file, object);
  }
}
