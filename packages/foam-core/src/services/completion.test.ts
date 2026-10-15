import { completionAt } from './completion';

/** What `completionAt` finds in `marked`, at the cursor its `‸` marks. */
const at = (marked: string) => {
  const cursor = marked.indexOf('‸');
  return completionAt(marked.replace('‸', ''), cursor);
};

describe('AC-1: a wikilink being typed', () => {
  it('has the text typed since its [[ as its query', () => {
    expect(at('Read [[zet‸')).toEqual({ kind: 'link', query: 'zet', start: 5 });
    expect(at('[[‸')).toEqual({ kind: 'link', query: '', start: 0 });
  });

  it('opens at the [[ of an embed, not at its !', () => {
    expect(at('![[im‸')).toEqual({ kind: 'link', query: 'im', start: 1 });
  });

  it('does not depend on the text after the cursor', () => {
    const expected = { kind: 'link', query: 'zet', start: 5 };
    expect(at('Read [[zet‸ later')).toEqual(expected);
    expect(at('Read [[zet‸]] later')).toEqual(expected);
  });
});

describe('AC-2: the wikilink core reads once it is closed', () => {
  it('opens at the first [[ when another follows it', () => {
    expect(at('[[a [[b‸')).toEqual({ kind: 'link', query: 'a [[b', start: 0 });
  });

  it('keeps a single ] in its query', () => {
    expect(at('[[foo] bar‸')).toEqual({
      kind: 'link',
      query: 'foo] bar',
      start: 0,
    });
  });

  it('opens after a link already closed on the line', () => {
    expect(at('[[a]] [[b‸')).toEqual({ kind: 'link', query: 'b', start: 6 });
  });

  it('is nothing once closed, escaped or opened on an earlier line', () => {
    expect(at('[[zettelkasten]] now‸')).toBeNull();
    expect(at('\\[[fo‸')).toBeNull();
    expect(at('[[fo\no‸')).toBeNull();
  });

  it('opens at the [[ after an escaped one, and after an escaped \\', () => {
    expect(at('\\[[a [[b‸')).toEqual({ kind: 'link', query: 'b', start: 5 });
    expect(at('\\\\[[a‸')).toEqual({ kind: 'link', query: 'a', start: 2 });
  });
});

describe('AC-3: a section or block anchor being typed', () => {
  it('is a section of the note named before the #', () => {
    expect(at('[[zettelkasten#Met‸')).toEqual({
      kind: 'section',
      target: 'zettelkasten',
      query: 'Met',
      start: 0,
    });
  });

  it('ends the target at the first #', () => {
    expect(at('[[note#a#b‸')).toEqual({
      kind: 'section',
      target: 'note',
      query: 'a#b',
      start: 0,
    });
  });

  it('has an empty target for a section of the note being edited', () => {
    expect(at('[[#Met‸')).toEqual({
      kind: 'section',
      target: '',
      query: 'Met',
      start: 0,
    });
  });

  it('is a block anchor after #^', () => {
    expect(at('[[zettelkasten#^bl‸')).toEqual({
      kind: 'block',
      target: 'zettelkasten',
      query: 'bl',
      start: 0,
    });
  });

  it('takes a # inside the link for a section, never a tag', () => {
    expect(at('[[foo #ta‸')).toEqual({
      kind: 'section',
      target: 'foo ',
      query: 'ta',
      start: 0,
    });
  });
});

describe('AC-4: an alias being typed', () => {
  it('is nothing to complete', () => {
    expect(at('[[zettelkasten|Zet‸')).toBeNull();
    expect(at('[[zettelkasten#Method|Me‸')).toBeNull();
  });
});

describe('AC-5: a tag being typed', () => {
  it('has the text typed since its # as its query', () => {
    expect(at('Idea #pk‸')).toEqual({
      kind: 'tag',
      query: 'pk',
      start: 5,
      frontmatter: false,
    });
    expect(at('#‸')).toEqual({
      kind: 'tag',
      query: '',
      start: 0,
      frontmatter: false,
    });
    expect(at('a #pkm/me‸')).toEqual({
      kind: 'tag',
      query: 'pkm/me',
      start: 2,
      frontmatter: false,
    });
  });

  it('holds the characters core accepts in a tag', () => {
    for (const query of ['🚀', '❤️', '👍🏽', '123']) {
      expect(at(`#${query}‸`)).toEqual({
        kind: 'tag',
        query,
        start: 0,
        frontmatter: false,
      });
    }
  });

  it('ends at a character a tag cannot hold', () => {
    expect(at('Idea #pkm and‸')).toBeNull();
    expect(at('#pkm.‸')).toBeNull();
  });

  it('is nothing for a # that does not start a word', () => {
    for (const marked of ['C#‸', '##‸', '# ‸', '(#ta‸', '\\#ta‸']) {
      expect(at(marked)).toBeNull();
    }
  });
});

describe('AC-6: a tag being typed in the frontmatter tags', () => {
  const tag = (query: string, start: number) => ({
    kind: 'tag',
    query,
    start,
    frontmatter: true,
  });

  it('is the word being typed in the value of tags', () => {
    expect(at('---\ntags: pkm, me‸')).toEqual(tag('me', 15));
    expect(at('---\ntags: [pkm, me‸')).toEqual(tag('me', 16));
    expect(at('---\ntags:\n  - me‸')).toEqual(tag('me', 14));
    expect(at('---\ntags: second‸, prim\n---\n')).toEqual(tag('second', 10));
  });

  it('has an empty query where a tag can start', () => {
    expect(at('---\ntags: ‸')).toEqual(tag('', 10));
    expect(at('---\ntags: [‸')).toEqual(tag('', 11));
    expect(at('---\ntags:\n  - ‸')).toEqual(tag('', 14));
    expect(at('---\ntags: second, prim\n ‸')).toEqual(tag('', 24));
  });

  it('holds the characters core accepts in a tag', () => {
    expect(at('---\ntags: pkm/‸')).toEqual(tag('pkm/', 10));
  });

  it('starts at a # typed before it', () => {
    expect(at('---\ntags: #pk‸')).toEqual(tag('pk', 10));
  });

  it('is nothing right after the colon or a list marker', () => {
    expect(at('---\ntags:‸')).toBeNull();
    expect(at('---\ntags:\n  -‸')).toBeNull();
  });

  it('counts frontmatter of any length, closed or not', () => {
    const keys = Array.from({ length: 60 }, (_, i) => `key${i}: value`);
    const text = `---\n${keys.join('\n')}\ntags: pk‸`;
    expect(at(text)).toEqual(tag('pk', text.indexOf('pk‸')));
    expect(at(`${text}\n---\n`)).toEqual(tag('pk', text.indexOf('pk‸')));
  });
});

describe('AC-7: the rest of the frontmatter', () => {
  it('completes no tag or wikilink outside the value of tags', () => {
    expect(at('---\ntitle: #pk‸')).toBeNull();
    expect(at('---\ntags: prim\ntitle: prim‸')).toBeNull();
    expect(at('---\nrelated: [[zet‸')).toBeNull();
    expect(at('---\nrelated: "[[zet‸')).toBeNull();
  });

  it('is body text again below the closing ---', () => {
    expect(at('---\ntitle: x\n---\ntags: pk‸')).toBeNull();
    expect(at('---\ntitle: x\n---\ntags: #pk‸')).toEqual({
      kind: 'tag',
      query: 'pk',
      start: 23,
      frontmatter: false,
    });
  });
});

describe('completionAt', () => {
  it('finds a tag in a heading and a link in a table cell', () => {
    expect(at('## Head #ta‸')).toEqual({
      kind: 'tag',
      query: 'ta',
      start: 8,
      frontmatter: false,
    });
    expect(at('| a | b |\n| - | - |\n| [[fo‸ | x |')).toEqual({
      kind: 'link',
      query: 'fo',
      start: 22,
    });
  });

  it('reads lines ended by \\r\\n', () => {
    expect(at('a\r\n[[fo‸')).toEqual({ kind: 'link', query: 'fo', start: 3 });
    expect(at('---\r\ntags: pk‸')).toEqual({
      kind: 'tag',
      query: 'pk',
      start: 11,
      frontmatter: true,
    });
  });

  it('finds a quoted tag in the frontmatter tags', () => {
    expect(at('---\ntags: ["pkm", "me‸')).toEqual({
      kind: 'tag',
      query: 'me',
      start: 19,
      frontmatter: true,
    });
  });

  it('finds nothing in text with no [[ or #', () => {
    expect(at('')).toBeNull();
    expect(at('Just some text‸')).toBeNull();
  });
});
