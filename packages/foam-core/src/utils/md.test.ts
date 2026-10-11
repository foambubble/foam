import { Range } from '../model/range';
import { URI } from '../model/uri';
import { createMarkdownParser } from '../services/markdown-parser';
import {
  getFrontMatterRange,
  isInFrontMatter,
  isOnYAMLKeywordLine,
  stripFrontMatter,
  stripFrontMatterAndTitle,
} from './md';

describe('isInFrontMatter', () => {
  it('is true for started front matter', () => {
    const content = `---

`;
    const actual = isInFrontMatter(content, 1);
    expect(actual).toBeTruthy();
  });
  it('is true for inside completed front matter', () => {
    const content = '---\ntitle: A title\n---\n';
    const actual = isInFrontMatter(content, 1);
    expect(actual).toBeTruthy();
  });
  it('is true inside front matter that follows blank lines', () => {
    const content = '\n---\ntitle: A title\n---\n';
    expect(isInFrontMatter(content, 2)).toBeTruthy();
  });
  it('is false above a --- further down the note', () => {
    const content = '# Title\ntext\n---\nmore\n---\n';
    expect(isInFrontMatter(content, 1)).toBeFalsy();
  });
  it('is true for inside completed front matter with "..." end delimiter', () => {
    const content = '---\ntitle: A title\n...\n';
    const actual = isInFrontMatter(content, 1);
    expect(actual).toBeTruthy();
  });
  it('does not take "..." for the end delimiter', () => {
    const content = '---\ntitle: A title\n...\ncontent\n---\nmore\n';
    expect(isInFrontMatter(content, 3)).toBeTruthy();
    expect(isInFrontMatter(content, 5)).toBeFalsy();
  });
  it('is false for non valid front matter delimiter #1347', () => {
    const content = '---\ntitle: A title\n-..\n\n\n---\ntest\n';
    expect(isInFrontMatter(content, 1)).toBeTruthy();
    expect(isInFrontMatter(content, 4)).toBeTruthy();
    expect(isInFrontMatter(content, 6)).toBeFalsy();
  });
  it('is false for outside completed front matter', () => {
    const content = '---\ntitle: A title\n---\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 3);
    expect(actual).toBeFalsy();
  });
  it('is false for position on initial front matter delimiter', () => {
    const content = '---\ntitle: A title\n---\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 0);
    expect(actual).toBeFalsy();
  });
  it('is false for position on final front matter delimiter', () => {
    const content = '---\ntitle: A title\n---\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 2);
    expect(actual).toBeFalsy();
  });

  describe('isOnYAMLKeywordLine', () => {
    it('is true if line starts with keyword', () => {
      const content = 'tags: foo, bar\n';
      const actual = isOnYAMLKeywordLine(content, 'tags');
      expect(actual).toBeTruthy();
    });
    it('is true if previous line starts with keyword', () => {
      const content = 'tags: foo\n - bar\n';
      const actual = isOnYAMLKeywordLine(content, 'tags');
      expect(actual).toBeTruthy();
    });
    it('is false if line starts with wrong keyword', () => {
      const content = 'tags: foo, bar\n';
      const actual = isOnYAMLKeywordLine(content, 'title');
      expect(actual).toBeFalsy();
    });
    it('is false if previous line starts with wrong keyword', () => {
      const content = 'dates:\n - 2023-01-1\n - 2023-01-02\n';
      const actual = isOnYAMLKeywordLine(content, 'tags');
      expect(actual).toBeFalsy();
    });
  });
});

describe('stripFrontMatter', () => {
  // Must not rely on gray-matter: it needs Node's Buffer at call time,
  // which crashes non-Node runtimes (React Native / Hermes).
  it('removes a frontmatter block from the start of the document', () => {
    const md = `---
title: My Note
tags: [a, b]
---

# Heading

Body text.`;
    expect(stripFrontMatter(md)).toBe('# Heading\n\nBody text.');
  });

  it('returns trimmed content when there is no frontmatter', () => {
    expect(stripFrontMatter('# Heading\n\nText\n')).toBe('# Heading\n\nText');
  });

  it('keeps the indentation of the first line after dropping blank lines', () => {
    expect(stripFrontMatter('---\na: 1\n---\n\n    code\n\nText')).toBe(
      '    code\n\nText'
    );
  });

  it('handles an empty frontmatter block', () => {
    expect(stripFrontMatter('---\n---\n# Title')).toBe('# Title');
  });

  it('leaves a thematic break that is not at the start alone', () => {
    const md = 'Intro\n\n---\n\nMore text';
    expect(stripFrontMatter(md)).toBe(md);
  });

  it('does not treat an unclosed opening delimiter as frontmatter', () => {
    const md = '---\ntitle: Unclosed\n\n# Heading';
    expect(stripFrontMatter(md)).toBe(md);
  });

  it('keeps a second --- line in the body (only the first block is frontmatter)', () => {
    const md = `---
title: T
---
Body

---

After break`;
    expect(stripFrontMatter(md)).toBe('Body\n\n---\n\nAfter break');
  });

  it('removes frontmatter that follows blank lines', () => {
    expect(stripFrontMatter('\n\n---\na: 1\n---\nBody')).toBe('Body');
  });

  it('removes frontmatter from a note with Windows line endings', () => {
    expect(stripFrontMatter('---\r\na: 1\r\n---\r\nBody\r\n')).toBe('Body');
  });

  it('leaves a block whose opening line is not --- alone, or closed by "...", in place', () => {
    expect(stripFrontMatter('--- \na: 1\n---\nBody')).toBe(
      '--- \na: 1\n---\nBody'
    );
    expect(stripFrontMatter('---\na: 1\n...\nBody')).toBe(
      '---\na: 1\n...\nBody'
    );
  });
});

describe('stripFrontMatterAndTitle', () => {
  it('keeps a --- rule under the title', () => {
    const md = '# Title\n---\nText\n---\nMore';
    const note = createMarkdownParser([]).parse(URI.file('/note.md'), md);

    expect(stripFrontMatterAndTitle(md, note.sections)).toBe(
      '---\nText\n---\nMore'
    );
  });

  it('removes the frontmatter and the title', () => {
    const md = '---\na: 1\n---\n\n# Title\n\nText';
    const note = createMarkdownParser([]).parse(URI.file('/note.md'), md);

    expect(stripFrontMatterAndTitle(md, note.sections)).toBe('Text');
  });
});

describe('getFrontMatterRange', () => {
  it('spans from the opening line to the end of the closing dashes', () => {
    expect(getFrontMatterRange('---\na: 1\n---\nBody')).toEqual(
      Range.create(0, 0, 2, 3)
    );
  });

  it('opens after blank lines and closes at the next line starting with ---', () => {
    expect(getFrontMatterRange('\n \t\n---\na: 1\n----\nb')).toEqual(
      Range.create(2, 0, 4, 3)
    );
  });

  it('is null without an opening line of --- alone at the start, or without a closing line', () => {
    for (const markdown of [
      '--- \na: 1\n---\n',
      '  ---\na: 1\n---\n',
      '# Title\n---\na: 1\n---\n',
      '---\na: 1\n...\n',
      '---\na: 1\n',
    ]) {
      expect(getFrontMatterRange(markdown)).toBeNull();
    }
  });

  it('agrees with the parser', () => {
    let tree: any;
    const parser = createMarkdownParser([
      { onDidVisitTree: visited => (tree = visited) },
    ]);
    const parsed = (markdown: string) => {
      parser.parse(URI.file('/note.md'), markdown);
      const yaml = tree.children.find(node => node.type === 'yaml');
      if (!yaml) {
        return null;
      }
      const { start, end } = yaml.position;
      return Range.create(
        start.line - 1,
        start.column - 1,
        end.line - 1,
        end.column - 1
      );
    };
    for (const markdown of [
      '---\na: 1\n---\nbody',
      '\n\n---\na: 1\n---\n',
      ' \t\n---\na: 1\n---\n',
      '--- \na: 1\n---\n',
      '---\r\na: 1\r\n---\r\nbody',
      '---\na: 1\n...\n',
      '---\na: 1\n----\nb',
      '---\na: 1\n--- x\n',
      '\uFEFF---\na: 1\n---\n',
      '# T\n---\na: 1\n---\n',
      '---\na: 1\n',
      '---\n---\n',
      '  ---\na: 1\n---',
      '---\na: 1\n  ---\nb: 2\n---\n',
      '---\na: 1\n---',
      '---\r\na: 1\r\n...\r\n---\r\n',
    ]) {
      expect([markdown, getFrontMatterRange(markdown)]).toEqual([
        markdown,
        parsed(markdown),
      ]);
    }
  });
});
