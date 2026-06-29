import MarkdownIt from 'markdown-it';
import { installIdScoping } from './id-scoping';

function makeMd(slug: string | null) {
  const md = MarkdownIt({ html: true });
  installIdScoping(md, () => slug);
  return md;
}

describe('installIdScoping', () => {
  it('scopes heading ids to the current note and slugs the heading text', () => {
    const html = makeMd('alpha').render('## My Section\n\nbody');
    expect(html).toContain('<h2 id="note-alpha--my-section">My Section</h2>');
  });

  it('rewrites and slugs every id in raw author HTML (both quote styles, inline and block)', () => {
    const md = makeMd('beta');
    const html = md.render(
      // an inline `<a>` (single quote) and a block `<div>` (double quote, with
      // spaces in the id) — both should come out scoped and slugged.
      `Paragraph with <a id='hello'></a>anchor.\n\n<div id="My Anchor">block</div>\n`
    );
    expect(html).toContain("id='note-beta--hello'");
    expect(html).toContain('id="note-beta--my-anchor"');
  });
});
