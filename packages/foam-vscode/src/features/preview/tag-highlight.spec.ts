/* @unit-ready */
import MarkdownIt from 'markdown-it';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
import { default as markdownItFoamTags } from './tag-highlight';

describe('Stylable tag generation in preview', () => {
  const md = markdownItFoamTags(MarkdownIt(), new FoamWorkspace());

  it('transforms a string containing multiple tags to a stylable html element', () => {
    expect(md.render(`Lorem #ipsum dolor #sit`)).toMatch(
      `<p>Lorem <span class='foam-tag'>#ipsum</span> dolor <span class='foam-tag'>#sit</span></p>`
    );
  });

  it('transforms a string containing a tag with dash', () => {
    expect(md.render(`Lorem ipsum dolor #si-t`)).toMatch(
      `<p>Lorem ipsum dolor <span class='foam-tag'>#si-t</span></p>`
    );
  });
});
