import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace';
import { default as markdownItFoamTags } from './tag-highlight';
import foamQuery from './query-embed';

describe('Just find the stupid codeblock lol', () => {
  const md = foamQuery(MarkdownIt(), new FoamWorkspace());

  it('transforms a string containing a query codeblock to a stylable html element', () => {
    expect(md.render(`\`\`\`query Hello World!\`\`\``)).toMatch(
      `<p><span class='foam-tag'>\`\`\`query Hello World!\`\`\`</span></p>`
    );
  });
});
