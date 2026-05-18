import { URI } from '@foam/core';
import { Logger } from '@foam/core';
import { createMarkdownParser } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { checkLinks, checkDuplicateBlocks } from './rule-check-links';

Logger.setLevel('error');

const parser = createMarkdownParser([]);

const makeWorkspace = (notes: { uri: string; content: string }[]) => {
  const ws = new FoamWorkspace();
  for (const { uri, content } of notes) {
    ws.set(parser.parse(URI.file(uri), content));
  }
  return ws;
};

describe('checkLinks', () => {
  it('returns no issues when all wikilinks resolve unambiguously', () => {
    const ws = makeWorkspace([
      { uri: '/a.md', content: 'Link to [[b]]' },
      { uri: '/b.md', content: '# B' },
    ]);
    const resource = ws.get(URI.file('/a.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(0);
  });

  it('returns an ambiguous-identifier issue when a link matches multiple targets', () => {
    const ws = makeWorkspace([
      { uri: '/project/todo.md', content: '# Todo' },
      { uri: '/another/todo.md', content: '# Todo' },
      { uri: '/note.md', content: 'Link to [[todo]]' },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('ambiguous-identifier');
    expect(issues[0].fix).toBeUndefined();
    expect(issues[0].relatedInfo).toHaveLength(2);
    expect(issues[0].relatedInfo!.every(i => i.message.startsWith('Possible target:'))).toBe(true);
  });

  it('returns no issue for an unknown-section when the target is a placeholder', () => {
    const ws = makeWorkspace([
      { uri: '/note.md', content: 'Link to [[nonexistent#Section 1]]' },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(0);
  });

  it('returns no issue when section exists in the target', () => {
    const ws = makeWorkspace([
      { uri: '/a.md', content: '# Section 1\nContent' },
      { uri: '/b.md', content: 'Link to [[a#Section 1]]' },
    ]);
    const resource = ws.get(URI.file('/b.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(0);
  });

  it('returns an unknown-section issue when the section is missing', () => {
    const ws = makeWorkspace([
      { uri: '/a.md', content: '# Section 1\nContent\n\n# Section 2\nMore' },
      { uri: '/b.md', content: 'Link to [[a#Section 99]]' },
    ]);
    const resource = ws.get(URI.file('/b.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('unknown-section');
    expect(issues[0].fix).toBeUndefined();
    expect(issues[0].relatedInfo!.map(i => i.message)).toEqual([
      'Section 1',
      'Section 2',
    ]);
  });

  it('returns an unknown-block issue when the block anchor is missing', () => {
    const ws = makeWorkspace([
      { uri: '/a.md', content: 'A paragraph ^existing' },
      { uri: '/b.md', content: 'Link to [[a#^ghost]]' },
    ]);
    const resource = ws.get(URI.file('/b.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('unknown-block');
    expect(issues[0].fix).toBeUndefined();
    expect(issues[0].relatedInfo!.map(i => i.message)).toEqual(['^existing']);
  });

  it('ignores non-wikilink links', () => {
    const ws = makeWorkspace([
      { uri: '/note.md', content: '[link](https://example.com)' },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    const issues = checkLinks(resource, ws);

    expect(issues).toHaveLength(0);
  });
});

describe('checkDuplicateBlocks', () => {
  it('returns no issues when all block IDs are unique', () => {
    const ws = makeWorkspace([
      { uri: '/note.md', content: 'Para one ^block1\n\nPara two ^block2\n' },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    expect(checkDuplicateBlocks(resource)).toHaveLength(0);
  });

  it('flags the duplicate (2nd+) occurrence, not the first', () => {
    const ws = makeWorkspace([
      { uri: '/note.md', content: 'Para one ^myblock\n\nPara two ^myblock\n' },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    const issues = checkDuplicateBlocks(resource);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('duplicate-block-id');
    expect(issues[0].fix).toBeUndefined();
    expect(issues[0].relatedInfo).toHaveLength(1);
    // Duplicate is on the second paragraph (line 2)
    expect(issues[0].range.start.line).toEqual(2);
  });

  it('flags the duplicate on a list item with nested subitems', () => {
    const ws = makeWorkspace([
      {
        uri: '/note.md',
        content: '- first item ^dup\n  - subitem\n\n- second item ^dup\n',
      },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    const issues = checkDuplicateBlocks(resource);

    expect(issues).toHaveLength(1);
    expect(issues[0].range.start.line).toEqual(3);
  });

  it('returns no issues for a list item with a unique block ID', () => {
    const ws = makeWorkspace([
      { uri: '/note.md', content: '- Item one ^listblock\n- Item two\n' },
    ]);
    const resource = ws.get(URI.file('/note.md'))!;

    expect(checkDuplicateBlocks(resource)).toHaveLength(0);
  });
});
